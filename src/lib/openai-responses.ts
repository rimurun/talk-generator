import { Topic, Script, FilterOptions } from '@/types';
import { memoryCache, createTopicsCacheKey, createScriptCacheKey } from './cache';

// OpenAI Responses API設定
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4o-mini';

// デバッグログ用
const DEBUG = process.env.NODE_ENV !== 'production';

// コスト計算用（GPT-4o-mini料金）
const COST_PER_1M_INPUT_TOKENS = 0.15; // $0.15
const COST_PER_1M_OUTPUT_TOKENS = 0.60; // $0.60

interface OpenAIResponsesRequest {
  model: string;
  tools: Array<{ type: string }>;
  input: string;
}

interface OpenAIResponsesResponse {
  output: {
    message: string;
    annotations?: Array<{
      type: string;
      title: string;
      url: string;
    }>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * OpenAI Responses APIを使用してweb_searchでトピック生成
 */
export async function generateTopicsWithWebSearch(filters: FilterOptions, previousTitles?: string[]): Promise<{
  topics: Topic[];
  cost: number;
  cached: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
}> {
  const cacheKey = createTopicsCacheKey(filters);
  const hasPreviousTitles = previousTitles && previousTitles.length > 0;
  
  // キャッシュチェック（前回タイトルがある場合はスキップ → 必ず新しい結果を取得）
  if (!hasPreviousTitles) {
    // インメモリキャッシュ → DB キャッシュの順にチェック
    let cachedTopics = memoryCache.getTopics(cacheKey);
    if (!cachedTopics) {
      cachedTopics = await memoryCache.getTopicsFromDb(cacheKey);
    }
    if (cachedTopics) {
      console.log('🎯 トピックキャッシュヒット（完全一致）');
      trackUsage(0, 0, true);
      return {
        topics: cachedTopics,
        cost: 0,
        cached: true,
        cacheHitType: 'exact'
      };
    }

    const fuzzyMatch = memoryCache.getTopicsFuzzy(filters);
    if (fuzzyMatch && fuzzyMatch.similarity >= 0.8) {
      console.log(`🔄 トピックキャッシュヒット（ファジーマッチ: ${Math.round(fuzzyMatch.similarity * 100)}%）`);
      trackUsage(0, 0, true);
      return {
        topics: fuzzyMatch.data,
        cost: 0,
        cached: true,
        cacheHitType: 'fuzzy'
      };
    }
  } else {
    console.log(`🔄 前回タイトル${previousTitles.length}件あり → キャッシュスキップ`);
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (DEBUG) console.log(`🔄 トピック生成試行 ${attempt}/${maxRetries}`);
      
      // 動的な日付文字列を生成（検索の鮮度を保つ）
      const now = new Date();
      const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月`;
      const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

      // カテゴリ別検索クエリ（日付を動的に埋め込み）
      const categoryQueries = {
        'ニュース': `日本 最新ニュース 今日 ${todayStr} 政治 経済 社会 テクノロジー`,
        'エンタメ': `エンタメ 最新 今週 ${dateStr} アニメ 映画 音楽 芸能 ゲーム 話題`,
        'SNS': `SNS トレンド 今日 ${todayStr} Twitter X Instagram YouTube バズ`,
        'TikTok': `TikTok 今日 ${todayStr} バズ チャレンジ トレンド 日本 海外`,
        '海外おもしろ': `海外 おもしろニュース 最新 ${dateStr} 珍事件 珍ニュース 面白い ユニーク 衝撃`,
        '事件事故': `事件 事故 災害 速報 今日 ${todayStr} 日本 世界`
      };

      // カテゴリフィルターに応じた検索クエリ選択
      let searchQueries = filters.categories.length > 0 
        ? filters.categories.map(cat => categoryQueries[cat as keyof typeof categoryQueries]).filter(Boolean)
        : Object.values(categoryQueries);

      // フリーワードキーワードが指定されている場合、検索クエリに追加
      const keyword = (filters as any).keyword?.trim();
      if (keyword) {
        searchQueries = searchQueries.map(q => `${keyword} ${q}`);
        // キーワード単体の検索も追加（今日の日付で鮮度を確保）
        searchQueries.unshift(`${keyword} 最新ニュース 今日 ${todayStr}`);
      }

      const categoryFilter = filters.categories.length > 0 ? 
        `カテゴリ指定: ${filters.categories.join(', ')}` : 
        '全カテゴリ（バランス重視）';
        
      const timeContext = new Date().getHours() < 12 ? '朝' : 
                         new Date().getHours() < 18 ? '昼' : '夜';
      
      const categoryBalanceInstruction = filters.categories.length === 0 || filters.categories.length > 1 
        ? `【重要：カテゴリバランス厳守】
※必ず以下の割合でトピックを生成してください：
- ニュース: 2件（政治・経済・社会・テクノロジー等の時事ニュース）
  - 海外おもしろ: 2件（海外の面白い・珍しい・ユニークなニュース）
- エンタメ: 3件（アニメ・映画・音楽・芸能・ゲーム）
- SNS: 3件（Twitter/X・Instagram・YouTube等のプラットフォーム動向）
- TikTok: 3件（TikTok固有のトレンド・チャレンジ・バズ動画）
${filters.includeIncidents ? '- 事件事故: 1件（事件・事故・災害）' : ''}

【SNSカテゴリの必須要素】
- X(Twitter)のトレンドハッシュタグ
- Instagramの話題投稿・ストーリー
- YouTubeの急上昇動画・ショート

【TikTokカテゴリの必須要素】  
- TikTokバズ動画・ダンス
- TikTokトレンド音楽・効果音
- TikTokチャレンジ・ハッシュタグ

※ニュース・エンタメに偏らず、全カテゴリから均等に生成必須` 
        : '';
      
      const input = `${todayStr} ${timeContext}の配信向けトピック生成。

【重要】必ず今日（${todayStr}）時点の最新情報を検索してください。古いニュースは除外。

検索: ${searchQueries.slice(0, 3).join(' / ')}
${categoryFilter}
${keyword ? `キーワード: ${keyword}` : ''}
${filters.includeIncidents ? '' : '事件事故除外'}
テンション: ${filters.tension}

${categoryBalanceInstruction ? '各カテゴリ均等に生成' : ''}

各トピックを以下形式で10-15件生成:
1. **[タイトル30文字以内]**
   - カテゴリ: [ニュース/エンタメ/SNS/TikTok/海外おもしろ/事件事故]
   - 要約: [2行以内]
   - 配信適性: [1行]

国内外バランスよく。実在URLも含める。
${previousTitles && previousTitles.length > 0 ? `除外: ${previousTitles.slice(0, 15).join(', ')}` : ''}`;

      const requestBody: OpenAIResponsesRequest = {
        model: MODEL,
        tools: [{ type: 'web_search_preview' }],
        input: input
      };

      // リクエストタイムアウト設定（30秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // エラーステータスの詳細処理
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        if (response.status === 429) {
          // レート制限エラー
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
          
          if (DEBUG) console.log(`⏳ レート制限により${waitTime}ms待機 (試行 ${attempt}/${maxRetries})`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          throw new Error(`レート制限エラー: API呼び出し頻度を下げてください（${response.status}）`);
        }
        
        if (response.status === 401) {
          throw new Error('認証エラー: APIキーが無効です');
        }
        
        if (response.status >= 500) {
          // サーバーエラーは再試行
          if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            if (DEBUG) console.log(`🔄 サーバーエラー、${waitTime}ms後に再試行 (${response.status})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
    
    if (DEBUG) {
      console.log('📊 API Response debug:', {
        outputLength: Array.isArray(data.output) ? data.output.length : 'not array',
        hasText: !!data.text
      });
    }
    
    // レスポンス解析（実際の構造に基づく）
    let topicsData: Topic[] = [];
    let annotations = [];
    
    try {
      // outputは配列で、[0]がweb_search_call、[1]がmessage
      if (Array.isArray(data.output) && data.output.length >= 2) {
        const messageObj = data.output[1]; // index 1がmessageオブジェクト
        
        if (DEBUG) console.log('📝 Message object type:', messageObj?.type);
        
        if (messageObj && messageObj.type === 'message' && messageObj.content && Array.isArray(messageObj.content)) {
          // content配列からoutput_textを探す
          const textContent = messageObj.content.find((c: any) => c.type === 'output_text');
          if (textContent) {
            const messageText = textContent.text || '';
            annotations = textContent.annotations || [];
            
            if (DEBUG) {
              console.log('📝 Message extracted length:', messageText.length);
              console.log('🔗 Annotations found:', annotations.length);
            }
            
            // メッセージからトピックJSONを抽出してパース
            const cleanedMessage = messageText.replace(/```json\s*|\s*```/g, '').trim();
            
            try {
              // JSONが含まれている場合はパース、そうでなければメッセージからトピック生成
              if (cleanedMessage.includes('{') && cleanedMessage.includes('[')) {
                topicsData = JSON.parse(cleanedMessage);
              } else {
                // テキストベースでトピック生成
                topicsData = parseTopicsFromText(messageText, annotations);
              }
            } catch (jsonError: any) {
              if (DEBUG) console.log('JSON解析失敗、テキストからトピック生成:', jsonError?.message || 'Unknown error');
              topicsData = parseTopicsFromText(messageText, annotations);
            }
          }
        }
      }
      
      if (topicsData.length === 0) {
        if (DEBUG) console.log('トピック抽出失敗、フォールバック実行');
        topicsData = extractTopicsFromMessage('Failed to parse response', filters);
      }
      
    } catch (parseError) {
      console.error('Response parse error:', parseError);
      topicsData = extractTopicsFromMessage('Failed to parse response', filters);
    }

    // 実在URLの抽出（annotationsから）
    if (annotations.length > 0) {
      annotations.forEach((annotation: any, index: number) => {
        if (annotation.type === 'url_citation' && topicsData[index] && annotation.url) {
          topicsData[index].sourceUrl = annotation.url;
        }
      });
    }

    // 重複トピック排除（タイトル類似度チェック）
    const uniqueTopics = removeDuplicateTopics(topicsData);
    
    // フィルター適用
    let filteredTopics = uniqueTopics;
    
    if (filters.categories.length > 1) {
      // 複数カテゴリ選択時のみフィルタ（検索クエリが既にカテゴリ特化してる）
      filteredTopics = filteredTopics.filter(topic => 
        filters.categories.includes(topic.category)
      );
    } else if (filters.categories.length === 1) {
      // 単一カテゴリ選択時: そのカテゴリのトピックのみ残す
      filteredTopics = filteredTopics.filter(topic =>
        topic.category === filters.categories[0]
      );
    }

    if (!filters.includeIncidents) {
      filteredTopics = filteredTopics.filter(topic => 
        topic.category !== '事件事故'
      );
    }

    // センシティブ判定の自動修正
    filteredTopics = filteredTopics.map(topic => {
      if (topic.category === '事件事故') {
        return {
          ...topic,
          sensitivityLevel: 3 as const,
          riskLevel: 'high' as const
        };
      }
      return topic;
    });

    // カテゴリバランス調整（各カテゴリから最低1件、最大5件）
    if (filters.categories.length === 0 || filters.categories.length > 1) {
      filteredTopics = balanceTopicCategories(filteredTopics);
    }

    // サーバーサイド重複フィルタリング（プロンプトだけに頼らない二重チェック）
    if (hasPreviousTitles) {
      const prevSet = new Set(previousTitles!.map(t => t.toLowerCase()));
      filteredTopics = filteredTopics.filter(topic => {
        const titleLower = topic.title.toLowerCase();
        // 完全一致チェック
        if (prevSet.has(titleLower)) return false;
        // 部分一致チェック（タイトルの50%以上が一致したら除外）
        for (const prev of prevSet) {
          const words = titleLower.split(/[\s、。・]+/).filter(w => w.length > 1);
          const matchCount = words.filter(w => prev.includes(w)).length;
          if (words.length > 0 && matchCount / words.length > 0.5) return false;
        }
        return true;
      });
    }

    // コスト計算
    const usage = data.usage;
    let cost = 0;
    if (usage) {
      const inputCost = (usage.input_tokens / 1000000) * COST_PER_1M_INPUT_TOKENS;
      const outputCost = (usage.output_tokens / 1000000) * COST_PER_1M_OUTPUT_TOKENS;
      cost = inputCost + outputCost;
    }

    // 使用量トラッキング
    const totalTokens = usage ? (usage.input_tokens + usage.output_tokens) : 0;
    trackUsage(totalTokens, cost, false);

    // キャッシュ保存
    memoryCache.setTopics(cacheKey, filteredTopics);

    return {
      topics: filteredTopics.slice(0, 15),
      cost,
      cached: false
    };

    } catch (error: any) {
      lastError = error as Error;
      console.error(`❌ 試行 ${attempt}/${maxRetries} 失敗:`, error?.message || 'Unknown error');
      
      // タイムアウトエラーの場合
      if (error?.name === 'AbortError') {
        if (DEBUG) console.log('⏱️ リクエストタイムアウト');
        if (attempt < maxRetries) {
          continue;
        }
        throw new Error('リクエストがタイムアウトしました。ネットワーク接続を確認してください。');
      }
      
      // ネットワークエラーの場合
      if (error?.message?.includes('fetch')) {
        if (DEBUG) console.log('🌐 ネットワークエラー');
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          if (DEBUG) console.log(`🔄 ${waitTime}ms後に再試行`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw new Error('ネットワークエラー: インターネット接続を確認してください。');
      }
      
      // 最後の試行の場合は例外を投げる
      if (attempt === maxRetries) {
        console.error('🚨 全ての再試行が失敗、フォールバックモードに移行');
        
        // フォールバック: 簡易トピック生成
        const fallbackTopics = generateFallbackTopics(filters);
        
        return {
          topics: fallbackTopics,
          cost: 0,
          cached: false
        };
      }
    }
  }

  // このポイントに到達する場合はエラー
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('予期しないエラーが発生しました');
}

/**
 * 台本生成（キャッシュ対応）- 標準Chat Completions API使用
 */
export async function generateScriptWithCache(
  topic: {
    id: string;
    title: string;
    category: 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' | '事件事故';
    summary: string;
    sensitivityLevel: 1 | 2 | 3;
    riskLevel: 'low' | 'medium' | 'high';
  },
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string
): Promise<{
  script: Script;
  cost: number;
  cached: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
}> {
  const cacheKey = createScriptCacheKey(topic.id, duration, tension, tone);
  
  // 完全一致キャッシュチェック（インメモリ → DB フォールバック）
  let cachedScript = memoryCache.getScript(cacheKey);
  if (!cachedScript) {
    cachedScript = await memoryCache.getScriptFromDb(cacheKey);
  }
  if (cachedScript) {
    console.log('🎯 台本キャッシュヒット（完全一致）');
    return {
      script: cachedScript,
      cost: 0,
      cached: true,
      cacheHitType: 'exact'
    };
  }

  // ファジーマッチキャッシュチェック
  const fuzzyMatch = memoryCache.getScriptFuzzy(topic.id, duration, tension, tone);
  if (fuzzyMatch) {
    console.log(`🔄 台本キャッシュヒット（ファジーマッチ: ${fuzzyMatch.baseKey}）`);
    return {
      script: fuzzyMatch.data,
      cost: 0,
      cached: true,
      cacheHitType: 'fuzzy'
    };
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  try {
    // プロンプト最適化（尺に応じてmax_tokens調整）
    const maxTokens = duration === 15 ? 500 : duration === 60 ? 1000 : 2000;
    const targetChars = duration === 15 ? 100 : duration === 60 ? 400 : 1200;
    
    // 口調プリセット別のサンプル文
    const toneExamples: {[key: string]: string} = {
      'フレンドリー': 'みなさん、こんにちは！今日はとっても面白い話題があるんです♪',
      'エネルギッシュ': 'よっしゃー！みんな〜！超ヤバいニュース見つけちゃったよ！！',
      '落ち着いた': 'こんにちは。今日は興味深い話題についてお話ししたいと思います。',
      'コメディ重視': 'はいはい〜、今日もツッコミどころ満載なネタが来ましたよ〜',
      'バランス重視': 'こんにちは！今回は結構話題になってるこちらをご紹介します。',
      '事実重視': '本日、以下の件について報告いたします。'
    };
    
    const systemPrompt = `あなたは配信者向け台本作成のプロです。

【設定】
- 尺: ${duration}秒 (約${targetChars}文字)
- テンション: ${tension} (${tension === 'high' ? 'エネルギッシュで盛り上がる' : tension === 'medium' ? 'バランス良く親しみやすい' : '落ち着いて丁寧'})
- 口調: ${tone}

【${tone}の文体サンプル】
"${toneExamples[tone] || toneExamples['バランス重視']}"

${topic.category === '事件事故' ? `
【事件事故専用テンプレート】
以下の要素を含む台本を作成:
- factualReport: 事実のみの冷静な報告
- seriousContext: 深刻さを伝える背景説明
- avoidanceNotes: 避けるべき表現や注意点
注意: 煽らない、犯人断定しない、感情過多NG、陰謀論排除、事実ベース、シリアストーン
` : `
【通常トピック用テンプレート】
以下の要素を含む台本を作成:
1. つかみ（opening）: 15-30文字、視聴者の注意を引く導入
2. ざっくり説明（explanation）: ${Math.floor(targetChars * 0.4)}文字程度、理解しやすい説明
3. 配信者コメント（streamerComment）: ${Math.floor(targetChars * 0.3)}文字程度、個人的な感想
4. 視聴者質問（viewerQuestions）: コメント参加しやすい具体的質問3つ
5. 話の広げ方（expansions）: 関連話題への展開方向3つ
6. 繋ぎ（transition）: 20-30文字、次話題への自然な移行
`}

【重要】指定されたトピック内容に基づいて台本を作成し、JSON形式で返してください。マークダウン不要。`;

    const userPrompt = `以下のトピック情報に基づいて台本を作成してください:

【トピック詳細】
- タイトル: ${topic.title}
- カテゴリ: ${topic.category}
- 要約: ${topic.summary}
- センシティブ度: ${topic.sensitivityLevel}/3 (${topic.sensitivityLevel === 3 ? '慎重に扱う' : topic.sensitivityLevel === 2 ? '注意が必要' : '安全'})
- 炎上リスク: ${topic.riskLevel} (${topic.riskLevel === 'high' ? '高リスク' : topic.riskLevel === 'medium' ? '中リスク' : '低リスク'})

【必須条件】
- 上記のトピック内容を正確に反映した台本にすること
- タイトルと要約の内容から逸脱しない
- カテゴリに適した話し方・表現を使用

JSON形式で返答:
{
  "id": "script-${topic.id}",
  "topicId": "${topic.id}",
  "duration": ${duration},
  "tension": "${tension}",
  "tone": "${tone}",
  "content": {
    ${topic.category === '事件事故' ? `
    "factualReport": "...",
    "seriousContext": "...",
    "avoidanceNotes": "..."
    ` : `
    "opening": "...",
    "explanation": "...",
    "streamerComment": "...",
    "viewerQuestions": ["...", "...", "..."],
    "expansions": ["...", "...", "..."],
    "transition": "..."
    `}
  }
}`;

    // 標準Chat Completions APIを使用
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // スクリプトデータ解析
    let scriptData: Script;
    try {
      const messageContent = data.choices[0]?.message?.content || '';
      const cleanedMessage = messageContent.replace(/```json\s*|\s*```/g, '').trim();
      scriptData = JSON.parse(cleanedMessage);
      
      // 構造検証
      if (!scriptData.content || typeof scriptData.content !== 'object') {
        throw new Error('Invalid script structure');
      }
      
    } catch (parseError: any) {
      if (DEBUG) console.log('JSON parse failed, using fallback:', parseError?.message || 'Unknown error');
      // フォールバック
      scriptData = createFallbackScript(topic, duration, tension, tone);
    }

    // コスト計算
    const usage = data.usage;
    let cost = 0;
    if (usage) {
      const inputCost = (usage.prompt_tokens / 1000000) * COST_PER_1M_INPUT_TOKENS;
      const outputCost = (usage.completion_tokens / 1000000) * COST_PER_1M_OUTPUT_TOKENS;
      cost = inputCost + outputCost;
    }

    // 使用量トラッキング
    const totalTokens = usage ? (usage.prompt_tokens + usage.completion_tokens) : 0;
    trackUsage(totalTokens, cost, false);

    // キャッシュ保存
    memoryCache.setScript(cacheKey, scriptData);

    return {
      script: scriptData,
      cost,
      cached: false
    };

  } catch (error: any) {
    console.error('Script generation error:', error?.message || 'Unknown error');
    throw error;
  }
}

/**
 * テキストとannotationsからトピックを生成
 */
function parseTopicsFromText(messageText: string, annotations: any[]): Topic[] {
  const topics: Topic[] = [];
  
  // メッセージを行で分割してトピックを探す
  const lines = messageText.split('\n');
  let currentTopic: Partial<Topic> = {};
  let topicCount = 0;
  
  for (let i = 0; i < lines.length && topicCount < 15; i++) {
    const line = lines[i].trim();
    
    // タイトル行を検出（1. 2. 3. または **で始まる）
    if (line.match(/^\d+\.\s*\*\*.*\*\*/) || line.match(/^\d+\.\s*.+/) || line.match(/^\*\*.*\*\*/)) {
      // 前のトピックが完了していれば保存
      if (currentTopic.title) {
        finalizeAndAddTopic(currentTopic, topics, annotations, topicCount);
        topicCount++;
      }
      
      // 新しいトピック開始
      let title = line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
      if (title.length > 30) {
        title = title.substring(0, 27) + '...';
      }
      
      currentTopic = {
        id: `topic-${Date.now()}-${topicCount}`,
        title: title,
        summary: '',
        createdAt: new Date().toISOString()
      };
    }
    // カテゴリ行を検出
    else if (line.match(/カテゴリ[：:]\s*/)) {
      const catMatch = line.replace(/.*カテゴリ[：:]\s*/, '').replace(/[\[\]]/g, '').trim();
      if (catMatch) {
        (currentTopic as any)._gptCategory = catMatch;
      }
    }
    // 説明行を検出
    else if (line && !line.match(/^[\s]*$/) && currentTopic.title) {
      // カテゴリ/配信適性/要約のラベル行は除外してsummaryに入れない
      const cleaned = line.replace(/^-\s*/, '').replace(/^(要約|配信適性)[：:]\s*/, '');
      if (cleaned && !line.match(/^-\s*(配信適性)[：:]/)) {
        if (currentTopic.summary) {
          currentTopic.summary += ' ' + cleaned;
        } else {
          currentTopic.summary = cleaned;
        }
      }
    }
  }
  
  // 最後のトピックも追加
  if (currentTopic.title) {
    finalizeAndAddTopic(currentTopic, topics, annotations, topicCount);
  }
  
  // パース結果が0件の場合のみログ出力（ダミー補完は廃止）
  if (topics.length === 0) {
    console.log("[WARN] GPTレスポンスからトピックをパースできませんでした");
  }

  // 重複除去（タイトル類似度）
  const seen = new Set();
  const unique = topics.filter(t => {
    const key = t.title.substring(0, 15);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

/**
 * トピックを完成させて配列に追加
 */
function finalizeAndAddTopic(topic: Partial<Topic>, topics: Topic[], annotations: any[], index: number): void {
  if (!topic.title) return;
  
  // タイトルの角括弧除去
  topic.title = topic.title.replace(/^\[(.+)\]$/, '$1').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1');
  
  // カテゴリ判定: GPTが指定したカテゴリを優先、なければテキストから推測
  const validCategories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ', '事件事故'];
  const gptCat = (topic as any)._gptCategory?.trim();
  const guessed = guessCategory(topic.title, topic.summary || '');
  const category = (gptCat && validCategories.includes(gptCat)) ? gptCat : guessed;
  if (typeof console !== 'undefined') console.log('[DEBUG] title:', topic.title, '| gptCat:', gptCat, '| guessed:', guessed, '| final:', category);
  
  // 要約のクリーニング＆長さ調整
  let summary = topic.summary || `${category}に関する最新の話題です。`;
  // Markdownリンク除去: ([text](url)) → 空、[text](url) → text、(url) → 空
  summary = summary
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (summary.length > 200) {
    summary = summary.substring(0, 197) + '...';
  }
  
  // センシティブレベル推測
  const sensitivityLevel = guessSensitivityLevel(topic.title, summary);
  
  topics.push({
    id: topic.id!,
    title: topic.title,
    category,
    summary,
    sensitivityLevel,
    riskLevel: sensitivityLevel >= 3 ? 'high' : sensitivityLevel >= 2 ? 'medium' : 'low',
    sourceUrl: annotations[index % annotations.length]?.url || 'https://news.example.com',
    createdAt: topic.createdAt!
  });
}

/**
 * テキストからカテゴリを推測
 */
function guessCategory(title: string, summary: string): 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' | '事件事故' {
  const text = (title + ' ' + summary).toLowerCase();
  
  // 事件事故キーワード
  if (text.includes('事件') || text.includes('事故') || text.includes('逮捕') || 
      text.includes('死亡') || text.includes('火災') || text.includes('事故死')) {
    return '事件事故';
  }
  
  // 海外おもしろキーワード（複合判定：海外×面白系 or 珍系単独）
  if ((text.match(/海外|外国|世界/) && text.match(/おもしろ|面白|笑|珍|ユニーク|びっくり|変|驚|衝撃|ヤバ/)) ||
      text.match(/珍事件|珍ニュース|おもしろニュース|面白ニュース|世界仰天|世界びっくり/)) {
    return '海外おもしろ';
  }

  // TikTokキーワード（SNSより先に判定）
  if (text.includes('tiktok') || text.includes('ティックトック') || 
      text.includes('チャレンジ') && text.includes('バズ') ||
      text.includes('tiktok') || text.includes('ダンスチャレンジ')) {
    return 'TikTok';
  }
  
  // SNSキーワード
  if (text.includes('twitter') || text.includes('x（旧') || text.includes('x(旧') ||
      text.includes('instagram') || text.includes('インスタ') ||
      text.includes('youtube') || text.includes('ユーチューブ') ||
      text.includes('sns') || text.includes('トレンド入り') ||
      text.includes('ハッシュタグ') || text.includes('バズ') ||
      text.includes('#') && (text.includes('投稿') || text.includes('話題'))) {
    return 'SNS';
  }

  // エンタメキーワード
  if (text.includes('ゲーム') || text.includes('原神') || text.includes('アニメ') ||
      text.includes('映画') || text.includes('音楽') || text.includes('芸能') ||
      text.includes('アイドル') || text.includes('歌手') || text.includes('ドラマ') ||
      text.includes('漫画') || text.includes('コンサート') || text.includes('ライブ')) {
    return 'エンタメ';
  }
  
  // スポーツキーワード
  if (text.includes('野球') || text.includes('サッカー') || text.includes('wbc') ||
      text.includes('選手') || text.includes('試合')) {
    return 'ニュース';
  }
  
  // デフォルトはニュース
  return 'ニュース';
}

/**
 * センシティブレベル推測
 */
function guessSensitivityLevel(title: string, summary: string): 1 | 2 | 3 {
  const text = (title + ' ' + summary).toLowerCase();
  
  // 高リスクキーワード
  if (text.includes('事件') || text.includes('事故') || text.includes('死亡') ||
      text.includes('逮捕') || text.includes('火災') || text.includes('災害')) {
    return 3;
  }
  
  // 中リスクキーワード
  if (text.includes('問題') || text.includes('批判') || text.includes('炎上') ||
      text.includes('議論') || text.includes('論争')) {
    return 2;
  }
  
  // デフォルトは低リスク
  return 1;
}

/**
 * ランダムなカテゴリを取得
 */
function getRandomCategory(): 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' {
  const categories: ('ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ')[] = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];
  return categories[Math.floor(Math.random() * categories.length)];
}

/**
 * メッセージからトピック抽出（フォールバック）
 */
function extractTopicsFromMessage(message: string, filters: FilterOptions): Topic[] {
  // パース失敗時は空配列を返し、呼び出し元でフォールバックトピックを使用
  console.warn('[WARN] トピック抽出失敗、フォールバックモードに移行');
  return generateFallbackTopics(filters);
}

/**
 * フォールバックスクリプト生成
 */
function createFallbackScript(
  topic: {
    id: string;
    title: string;
    category: 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' | '事件事故';
    summary: string;
    sensitivityLevel: 1 | 2 | 3;
    riskLevel: 'low' | 'medium' | 'high';
  },
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string
): Script {
  if (topic.category === '事件事故') {
    return {
      id: `script-${topic.id}`,
      topicId: topic.id,
      duration,
      tension,
      tone,
      content: {
        factualReport: `「${topic.title}」について、現時点で公表されている情報をお伝えします。`,
        seriousContext: `${topic.summary}との報告があります。関係機関による調査が進められている状況です。`,
        avoidanceNotes: '詳細な憶測や個人的な見解については控え、正式な発表を待つことが重要です。'
      }
    };
  }

  return {
    id: `script-${topic.id}`,
    topicId: topic.id,
    duration,
    tension,
    tone,
    content: {
      opening: `こんにちは！今日は「${topic.title}」について話していきたいと思います。`,
      explanation: topic.summary,
      streamerComment: `${topic.category}の話題としては、これは結構注目すべき内容だと思います。`,
      viewerQuestions: [
        `${topic.title}についてどう思いますか？`,
        `${topic.category}関連で似た話題知ってますか？`,
        '今後どうなっていくと思いますか？'
      ],
      expansions: [
        `${topic.category}分野の最新動向`,
        '関連する他のトピックとの比較',
        '今後の予測と影響について'
      ],
      transition: '次の話題も面白いので続けて見ていきましょう。'
    }
  };
}

/**
 * 重複トピック排除
 */
function removeDuplicateTopics(topics: Topic[]): Topic[] {
  const uniqueTopics: Topic[] = [];
  
  for (const topic of topics) {
    let isDuplicate = false;
    
    for (const existing of uniqueTopics) {
      // タイトル類似度チェック（編集距離ベース）
      const similarity = calculateSimilarity(topic.title, existing.title);
      
      // 70%以上類似している場合は重複とみなす
      if (similarity > 0.7) {
        isDuplicate = true;
        break;
      }
      
      // 完全一致チェック
      if (topic.title === existing.title) {
        isDuplicate = true;
        break;
      }
      
      // 要約の重複チェック（キーワードベース）
      const topicKeywords = extractKeywords(topic.summary);
      const existingKeywords = extractKeywords(existing.summary);
      const keywordOverlap = calculateKeywordOverlap(topicKeywords, existingKeywords);
      
      if (keywordOverlap > 0.8) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      uniqueTopics.push(topic);
    }
  }
  
  return uniqueTopics;
}

/**
 * 文字列類似度計算（バイグラムベースJaccard係数、日本語対応）
 */
function calculateSimilarity(str1: string, str2: string): number {
  // バイグラム（2文字連続）ベースのJaccard係数（日本語対応）
  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);

  let intersectionCount = 0;
  bigrams1.forEach(bg => {
    if (bigrams2.has(bg)) intersectionCount++;
  });

  const unionCount = bigrams1.size + bigrams2.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * キーワード抽出（簡易版）
 */
function extractKeywords(text: string): string[] {
  // ストップワード除去とキーワード抽出
  const stopWords = ['の', 'に', 'は', 'を', 'が', 'で', 'と', 'も', 'から', 'より', 'まで'];
  const words = text.split(/\s+/).filter(word => 
    word.length > 1 && !stopWords.includes(word)
  );
  
  // ES5互換の重複除去
  const uniqueWords: string[] = [];
  const seen = new Set<string>();
  
  words.forEach(word => {
    if (!seen.has(word)) {
      seen.add(word);
      uniqueWords.push(word);
    }
  });
  
  return uniqueWords;
}

/**
 * キーワード重複率計算
 */
function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  // ES5互換の実装
  const intersectionArray: string[] = [];
  set1.forEach(keyword => {
    if (set2.has(keyword)) {
      intersectionArray.push(keyword);
    }
  });
  
  const unionArray: string[] = [];
  set1.forEach(keyword => unionArray.push(keyword));
  set2.forEach(keyword => {
    if (!set1.has(keyword)) {
      unionArray.push(keyword);
    }
  });
  
  return intersectionArray.length / unionArray.length;
}

/**
 * カテゴリバランス調整
 */
function balanceTopicCategories(topics: Topic[]): Topic[] {
  const categories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ', '事件事故'];
  const balanced: Topic[] = [];
  
  // 各カテゴリから最大3件ずつ取得
  for (const category of categories) {
    const categoryTopics = topics
      .filter(topic => topic.category === category)
      .slice(0, 3); // 最大3件
    
    balanced.push(...categoryTopics);
  }
  
  // 不足している場合は残りから補完
  const remaining = topics.filter(topic => !balanced.some(b => b.id === topic.id));
  const needed = Math.max(0, 10 - balanced.length);
  
  balanced.push(...remaining.slice(0, needed));
  
  return balanced.slice(0, 15); // 最大15件
}

/**
 * フォールバックトピック生成
 */
function generateFallbackTopics(filters: FilterOptions): Topic[] {
  const fallbackTopics: Topic[] = [
    {
      id: `fallback-${Date.now()}-1`,
      title: '話題のAI技術について',
      category: 'ニュース',
      summary: '最近のAI技術の進歩について、配信者として感じることや視聴者の皆さんの意見を聞いてみたいと思います。',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://news.example.com',
      createdAt: new Date().toISOString()
    },
    {
      id: `fallback-${Date.now()}-2`,
      title: '今話題のゲーム・アニメ',
      category: 'エンタメ',
      summary: '最近リリースされたゲームや放送中のアニメで気になる作品について話してみませんか？',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://entertainment.example.com',
      createdAt: new Date().toISOString()
    },
    {
      id: `fallback-${Date.now()}-3`,
      title: 'SNSで見かけた面白い話',
      category: 'SNS',
      summary: '最近SNSで話題になった面白い投稿や、バズっているトピックについて雑談しましょう。',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://social.example.com',
      createdAt: new Date().toISOString()
    },
    {
      id: `fallback-${Date.now()}-4`,
      title: 'TikTokの人気チャレンジ',
      category: 'TikTok',
      summary: '今TikTokで流行っているチャレンジや面白い動画について、みんなで盛り上がりましょう。',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://tiktok.example.com',
      createdAt: new Date().toISOString()
    },
    {
      id: `fallback-${Date.now()}-5.5`,
      title: '海外で話題のユニークニュース',
      category: '海外おもしろ',
      summary: '海外で話題になっている面白い・ユニークなニュースを紹介。思わず笑ってしまう珍事件や、びっくりするような出来事。',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://foreign-funny.example.com',
      createdAt: new Date().toISOString()
    },
    {
      id: `fallback-${Date.now()}-6`,
      title: '季節の話題・イベント',
      category: 'ニュース',
      summary: '今の時期ならではの話題や、これから予定されているイベントについて話してみませんか？',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://seasonal.example.com',
      createdAt: new Date().toISOString()
    }
  ];

  // フィルター適用
  let filteredFallback = fallbackTopics;
  
  if (filters.categories.length > 0) {
    filteredFallback = filteredFallback.filter(topic => 
      filters.categories.includes(topic.category)
    );
  }

  if (!filters.includeIncidents) {
    filteredFallback = filteredFallback.filter(topic => 
      topic.category !== '事件事故'
    );
  }

  // 不足分を補完
  while (filteredFallback.length < 8) {
    const additional: Topic = {
      id: `fallback-${Date.now()}-${filteredFallback.length + 1}`,
      title: `配信者雑談トピック #${filteredFallback.length + 1}`,
      category: getRandomCategory(),
      summary: '配信での雑談に使える汎用的な話題です。視聴者との交流にご活用ください。',
      sensitivityLevel: 1,
      riskLevel: 'low',
      sourceUrl: 'https://fallback.example.com',
      createdAt: new Date().toISOString()
    };
    filteredFallback.push(additional);
  }

  if (DEBUG) console.log(`📋 フォールバックトピック ${filteredFallback.length}件を生成`);
  return filteredFallback;
}

// サーバーサイド使用量トラッカー（インメモリ、リクエストごとに蓄積）
const usageTracker = {
  date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }),
  tokensUsed: 0,
  requestsUsed: 0,
  estimatedCost: 0,
  cacheHits: 0,
  totalRequests: 0,
};

function resetTrackerIfNewDay() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  if (usageTracker.date !== today) {
    usageTracker.date = today;
    usageTracker.tokensUsed = 0;
    usageTracker.requestsUsed = 0;
    usageTracker.estimatedCost = 0;
    usageTracker.cacheHits = 0;
    usageTracker.totalRequests = 0;
  }
}

export function trackUsage(tokens: number, cost: number, cached: boolean) {
  resetTrackerIfNewDay();
  usageTracker.totalRequests++;
  if (cached) {
    usageTracker.cacheHits++;
  } else {
    usageTracker.tokensUsed += tokens;
    usageTracker.requestsUsed++;
    usageTracker.estimatedCost += cost;
  }
}

/**
 * API使用統計（リアルタイムトラッキング、1日30回制限）
 */
export async function getApiUsageStats() {
  resetTrackerIfNewDay();
  const cacheHitRate = usageTracker.totalRequests > 0
    ? usageTracker.cacheHits / usageTracker.totalRequests
    : 0;
  return {
    tokensUsed: usageTracker.tokensUsed,
    tokensLimit: 100000,
    requestsUsed: usageTracker.requestsUsed,
    requestsLimit: 30,
    estimatedCost: usageTracker.estimatedCost,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
  };
}