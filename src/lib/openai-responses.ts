import { Topic, Script, FilterOptions } from '@/types';
import { memoryCache, createTopicsCacheKey, createScriptCacheKey } from './cache';
import { filterTopics, sanitizeScript } from './content-moderation';

// web_search_previewツール設定型
interface WebSearchTool {
  type: string;
  search_context_size?: string;
  user_location?: {
    type: string;
    country: string;
    region: string;
    timezone: string;
  };
}

// ストリーミングAPI用リクエスト型
interface OpenAIStreamRequest {
  model: string;
  tools: WebSearchTool[];
  input: string;
  stream: true;
}

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
  tools: WebSearchTool[];
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
    if (fuzzyMatch && fuzzyMatch.similarity >= 0.80) {
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

      // カテゴリ別検索クエリ（日付を先頭に配置してウェイトを上げる）
      const categoryQueries = {
        'ニュース': `${todayStr} 日本 最新ニュース 速報 政治 経済 社会 テクノロジー`,
        'エンタメ': `${todayStr} エンタメ 最新 アニメ 映画 音楽 芸能 ゲーム 話題`,
        'SNS': `${todayStr} SNS トレンド Twitter X Instagram YouTube バズ 話題`,
        'TikTok': `${todayStr} TikTok バズ チャレンジ トレンド 日本 海外`,
        '海外おもしろ': `${todayStr} 海外 おもしろニュース 珍事件 珍ニュース 面白い ユニーク 衝撃`,
        '事件事故': `${todayStr} 事件 事故 速報 最新ニュース 逮捕 火災 災害 日本`
      };

      // カテゴリ詳細フィルターの適用（期間・地域・サブカテゴリでクエリを強化）
      const categoryDetails = (filters as any).categoryDetails as Record<string, any> | undefined;
      if (categoryDetails) {
        for (const [cat, detail] of Object.entries(categoryDetails)) {
          if (!detail) continue;
          const baseQuery = categoryQueries[cat as keyof typeof categoryQueries];
          if (!baseQuery) continue;

          // 期間フィルター文字列
          let timeQuery = '';
          if (detail.timePeriod === 'today')  timeQuery = `今日 ${todayStr}`;
          else if (detail.timePeriod === 'week')  timeQuery = `今週 ${dateStr}`;
          else if (detail.timePeriod === 'month') timeQuery = `今月 ${dateStr}`;

          // 地域フィルター文字列
          let regionQuery = '';
          if (detail.region === 'domestic')      regionQuery = '日本 国内';
          else if (detail.region === 'international') regionQuery = '海外 世界 国際';
          // 'both' の場合はフィルターなし

          // サブカテゴリのラベルを日本語で連結
          const subCatLabels = (detail.subCategories as string[] || []).join(' ');

          // クエリを再構築（詳細条件を先頭に配置してウェイトを上げる）
          (categoryQueries as Record<string, string>)[cat] =
            `${timeQuery} ${regionQuery} ${subCatLabels} ${baseQuery}`.replace(/\s+/g, ' ').trim();
        }
      }

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
      
      // カテゴリ詳細フィルターのサマリーをプロンプト用に生成
      const detailSummaryLines: string[] = [];
      if (categoryDetails) {
        for (const [cat, detail] of Object.entries(categoryDetails)) {
          if (!detail) continue;
          const periodLabel = detail.timePeriod === 'today' ? '今日' : detail.timePeriod === 'week' ? '今週' : '今月';
          const regionLabel = detail.region === 'domestic' ? '国内のみ' : detail.region === 'international' ? '海外のみ' : '国内外両方';
          const subLabel = (detail.subCategories as string[]).length > 0 ? `サブ: ${(detail.subCategories as string[]).join('/')}` : '';
          detailSummaryLines.push(`  - ${cat}: 期間=${periodLabel}, 地域=${regionLabel}${subLabel ? `, ${subLabel}` : ''}`);
        }
      }
      const detailSummary = detailSummaryLines.length > 0
        ? `\n【カテゴリ詳細指定】\n${detailSummaryLines.join('\n')}`
        : '';

      // カテゴリ選択に応じたカテゴリリスト文字列（プロンプトのフォーマット指定用）
      const allowedCategories = filters.categories.length > 0
        ? filters.categories.join('/')
        : 'ニュース/エンタメ/SNS/TikTok/海外おもしろ/事件事故';

      // 単一カテゴリ指定時のカテゴリ固定指示
      const singleCategoryInstruction = filters.categories.length === 1
        ? `【重要】すべてのトピックのカテゴリは「${filters.categories[0]}」にしてください。他のカテゴリは生成禁止。`
        : '';

      // 圧縮プロンプト（約40%トークン削減）
      const input = `${todayStr}${timeContext}配信ネタ生成。最新情報のみ。web検索で実際の話題を取得。
【鮮度厳守】直近24〜48時間以内に報道・投稿された話題のみ。古いニュースは絶対に含めないこと。
検索: ${searchQueries.slice(0, 5).join(' / ')}
${categoryFilter}${keyword ? `\nキーワード: ${keyword}` : ''}
${filters.includeIncidents ? '' : '事件事故除外'}テンション: ${filters.tension}${detailSummary}
${singleCategoryInstruction}
${categoryBalanceInstruction}

15件生成（国内外バランス）。必ず以下の形式を厳守:
1. **タイトルをここに書く（50字以内、「...」は使わない）**
   - カテゴリ: [${allowedCategories}]
   - 記事日付: YYYY-MM-DD（情報の公開日・発生日。不明なら「不明」）
   - 要約: この話題の内容を具体的に1〜2文で説明する（「〜についての最新情報です」のような空虚な文は禁止）
   - 配信適性: [1行]
${previousTitles && previousTitles.length > 0 ? `除外: ${previousTitles.slice(0, 15).join(', ')}` : ''}`;

      const requestBody: OpenAIResponsesRequest = {
        model: MODEL,
        tools: [{
          type: 'web_search_preview',
          search_context_size: 'high',
          user_location: {
            type: 'approximate',
            country: 'JP',
            region: '東京都',
            timezone: 'Asia/Tokyo'
          }
        }],
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

    // カテゴリフィルタリング（指定カテゴリ以外のトピックを除外）
    if (filters.categories.length > 0) {
      const allowedSet = new Set(filters.categories);
      const beforeCount = filteredTopics.length;
      filteredTopics = filteredTopics.filter(topic => allowedSet.has(topic.category));
      if (filteredTopics.length < beforeCount) {
        console.log(`[CategoryFilter] ${beforeCount - filteredTopics.length}件の対象外カテゴリトピックを除外`);
      }
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

    // システムNGワードによるフィルタリング
    const { filtered: safeTopics, removed: removedCount } = filterTopics(filteredTopics);
    if (removedCount > 0) {
      console.log(`[ContentModeration] ${removedCount}件のトピックをフィルタリング`);
    }

    // キャッシュ保存（0件の場合はキャッシュしない）
    if (safeTopics.length > 0) {
      memoryCache.setTopics(cacheKey, safeTopics);
    }

    return {
      topics: safeTopics.slice(0, 15),
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
 * ストリーミングモードでトピックを1件ずつ生成・yield
 * OpenAI Responses APIのSSEレスポンスをパースし、
 * 完全なトピックブロックが検出されるたびにyieldする
 */
export async function* generateTopicsStream(
  filters: FilterOptions,
  previousTitles?: string[]
): AsyncGenerator<Topic> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const timeContext = now.getHours() < 12 ? '朝' : now.getHours() < 18 ? '昼' : '夜';

  // カテゴリ別検索クエリ（日付を先頭に配置してウェイトを上げる）
  const categoryQueries: Record<string, string> = {
    'ニュース': `${todayStr} 日本 最新ニュース 速報 政治 経済 社会 テクノロジー`,
    'エンタメ': `${todayStr} エンタメ 最新 アニメ 映画 音楽 芸能 ゲーム 話題`,
    'SNS': `${todayStr} SNS トレンド Twitter X Instagram YouTube バズ 話題`,
    'TikTok': `${todayStr} TikTok バズ チャレンジ トレンド 日本 海外`,
    '海外おもしろ': `${todayStr} 海外 おもしろニュース 珍事件 珍ニュース 面白い ユニーク 衝撃`,
    '事件事故': `${todayStr} 事件 事故 速報 最新ニュース 逮捕 火災 災害 日本`
  };

  const searchQueries = filters.categories.length > 0
    ? filters.categories.map(cat => categoryQueries[cat]).filter(Boolean)
    : Object.values(categoryQueries);

  const keyword = (filters as any).keyword?.trim();
  const categoryFilter = filters.categories.length > 0
    ? `カテゴリ指定: ${filters.categories.join(', ')}`
    : '全カテゴリ（バランス重視）';

  // カテゴリバランス指示（ストリーミング用）
  const streamBalanceInstruction = filters.categories.length === 0 || filters.categories.length > 1
    ? `【カテゴリバランス厳守】以下の割合で必ず生成:
- ニュース: 3件（政治・経済・社会・テクノロジー）
- エンタメ: 3件（アニメ・映画・音楽・芸能・ゲーム）
- SNS: 3件（X/Twitter・Instagram・YouTubeのバズ・トレンド）
- TikTok: 3件（バズ動画・チャレンジ・トレンド音楽）
- 海外おもしろ: 3件（海外の珍ニュース・ユニークな話題）
${filters.includeIncidents ? '- 事件事故: 1件' : ''}
※ニュース・エンタメだけに偏るのは禁止。SNS・TikTok・海外おもしろも必須`
    : '';

  // カテゴリ選択に応じたカテゴリリスト文字列
  const streamAllowedCategories = filters.categories.length > 0
    ? filters.categories.join('/')
    : 'ニュース/エンタメ/SNS/TikTok/海外おもしろ/事件事故';

  // 単一カテゴリ指定時のカテゴリ固定指示
  const streamSingleCategoryInstruction = filters.categories.length === 1
    ? `【重要】すべてのトピックのカテゴリは「${filters.categories[0]}」にしてください。他のカテゴリは生成禁止。`
    : '';

  // 圧縮プロンプト（ストリーミング用・検索クエリ拡大）
  const input = `${todayStr}${timeContext}配信ネタ生成。最新情報のみ。web検索で実際の話題を取得。
【鮮度厳守】直近24〜48時間以内に報道・投稿された話題のみ。古いニュースは絶対に含めないこと。
検索: ${searchQueries.slice(0, 5).join(' / ')}
${categoryFilter}${keyword ? `\nキーワード: ${keyword}` : ''}
${filters.includeIncidents ? '' : '事件事故除外'}テンション: ${filters.tension}
${streamSingleCategoryInstruction}
${streamBalanceInstruction}

15件生成。必ず以下の形式を厳守:
1. **タイトルをここに書く（50字以内、「...」は使わない）**
   - カテゴリ: [${streamAllowedCategories}]
   - 記事日付: YYYY-MM-DD（情報の公開日・発生日。不明なら「不明」）
   - 要約: この話題の内容を具体的に1〜2文で説明する（「〜についての最新情報です」のような空虚な文は禁止）
   - 配信適性: [1行]
${previousTitles && previousTitles.length > 0 ? `除外: ${previousTitles.slice(0, 15).join(', ')}` : ''}`;

  const requestBody: OpenAIStreamRequest = {
    model: MODEL,
    tools: [{
      type: 'web_search_preview',
      search_context_size: 'high',
      user_location: {
        type: 'approximate',
        country: 'JP',
        region: '東京都',
        timezone: 'Asia/Tokyo'
      }
    }],
    input,
    stream: true
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    throw fetchError;
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // SSEストリームをテキストとして読み込み、トピックをインクリメンタルにパース
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('レスポンスボディの読み込みに失敗しました');
  }

  const decoder = new TextDecoder();
  let accumulatedText = ''; // OpenAIからのテキストデルタを蓄積
  let buffer = '';           // SSEイベントバッファ
  let yieldedTopicCount = 0;
  const yieldedTitles = new Set<string>();
  // 前回パース時点のテキスト長。一定量蓄積するまでパースを抑制する
  let lastParsedLength = 0;
  // ストリーミング中パースの最小増分（短すぎる増分でのパースを防ぐ）
  const MIN_PARSE_DELTA = 200;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSEイベントを行単位で処理
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 不完全な最後の行はバッファへ

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        let event: any;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue; // 不完全なJSONはスキップ
        }

        // テキストデルタを蓄積（output_text.delta イベント）
        if (event.type === 'response.output_text.delta' && event.delta) {
          accumulatedText += event.delta;

          // 前回パースからの増分が MIN_PARSE_DELTA 未満の場合はスキップ
          // → タイトル行が末尾に来た状態（未完成）でパースするのを防ぐ
          const delta = accumulatedText.length - lastParsedLength;
          if (delta < MIN_PARSE_DELTA) continue;

          // 次のトピック開始行が存在することを確認してからパース
          // （現在の最後のトピック行が完結していない場合を除外する）
          const hasNextTopicBoundary = isTextReadyForParsing(accumulatedText);
          if (!hasNextTopicBoundary) continue;

          lastParsedLength = accumulatedText.length;

          // 蓄積テキストからトピックブロックを検出してyield
          const newTopics = extractNewTopicsFromStream(
            accumulatedText,
            yieldedTopicCount,
            yieldedTitles
          );

          for (const topic of newTopics) {
            // カテゴリフィルタリング（指定カテゴリ以外はスキップ）
            if (filters.categories.length > 0 && !filters.categories.includes(topic.category)) continue;
            yieldedTitles.add(topic.title.substring(0, 15));
            yieldedTopicCount++;
            yield topic;
          }
        }
      }
    }

    // ストリーム完了後、残りのテキストから未yield分を抽出
    const finalTopics = extractNewTopicsFromStream(
      accumulatedText,
      yieldedTopicCount,
      yieldedTitles
    );
    for (const topic of finalTopics) {
      // カテゴリフィルタリング（指定カテゴリ以外はスキップ）
      if (filters.categories.length > 0 && !filters.categories.includes(topic.category)) continue;
      yieldedTitles.add(topic.title.substring(0, 15));
      yieldedTopicCount++;
      yield topic;
    }

  } finally {
    reader.releaseLock();
  }
}

/**
 * ストリーミング途中のテキストがパースに十分かどうか判定
 * 末尾が「タイトル行のみ」で終わっている場合は false を返す
 * （タイトルが完全に揃っていても要約が未着信の場合は yield しない）
 */
function isTextReadyForParsing(text: string): boolean {
  const lines = text.trimEnd().split('\n');
  // 末尾から空行を除いた最後の行を取得
  let lastNonEmpty = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      lastNonEmpty = lines[i].trim();
      break;
    }
  }

  // 末尾行が番号付きタイトル行（例: `1. **...`）の場合はまだ不完全
  if (lastNonEmpty.match(/^\d+\.\s*\*\*/)) return false;

  // 少なくとも1つの完成したトピックブロックが存在するか確認
  // （次の番号付き行か、ストリーム末尾で最初のトピックが完結しているか）
  const hasAtLeastOneComplete = /^\d+\.\s*\*\*.*\*\*[^\n]*\n/m.test(text);
  return hasAtLeastOneComplete;
}

/**
 * ストリーミング中の蓄積テキストから新規トピックを抽出
 * 既にyield済みのタイトルは除外する
 */
function extractNewTopicsFromStream(
  text: string,
  alreadyYielded: number,
  yieldedTitles: Set<string>
): Topic[] {
  // parseTopicsFromText を再利用してトピックをパース
  const allTopics = parseTopicsFromText(text, []);

  // 未yield分のみ返す
  return allTopics.slice(alreadyYielded).filter(t => {
    const key = t.title.substring(0, 15);
    return !yieldedTitles.has(key);
  });
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
  tone: string,
  styleProfile?: string // ユーザースタイルプロファイル（省略可）
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
    
    // 圧縮済みシステムプロンプト（冗長なトーン例・重複指示を削除）
    let systemPrompt = `配信者向け台本作成。
尺: ${duration}秒(約${targetChars}文字) / テンション: ${tension} / 口調: ${tone}
${topic.category === '事件事故'
  ? '事件事故モード: 事実のみ・煽り禁止・断定禁止・シリアストーン。JSON返答のみ。'
  : `通常モード: opening(導入)・explanation(説明${Math.floor(targetChars * 0.4)}字)・streamerComment(感想${Math.floor(targetChars * 0.3)}字)・viewerQuestions(3問)・expansions(展開3件)・transition(繋ぎ)。JSON返答のみ。`
}`;

    // ユーザースタイルプロファイルがある場合はプロンプトに追記
    if (styleProfile) {
      systemPrompt += `\n\n${styleProfile}`;
    }

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

    // 標準Chat Completions APIを使用（429リトライ付き）
    const maxRetries = 3;
    let data: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

      if (response.ok) {
        data = await response.json();
        break;
      }

      // 429レート制限: バックオフしてリトライ
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        const delay = retryAfter > 0 ? retryAfter * 1000 : attempt * 2000;
        console.log(`OpenAI 429 - ${delay}ms後にリトライ (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
    }

    if (!data) {
      throw new Error('OpenAI API: 最大リトライ回数を超えました');
    }
    
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

    // 台本テキストのサニタイズ（NGワードを「***」に置換）
    const safeScriptData = sanitizeScriptContent(scriptData);

    // キャッシュ保存
    memoryCache.setScript(cacheKey, safeScriptData);

    return {
      script: safeScriptData,
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

  // フィールドラベルのプレフィックスパターン（これで始まる行はタイトルではない）
  // 例: 「カテゴリ: ニュース」「要約: ...」「**カテゴリ: ...**」など
  const FIELD_LABEL_RE = /^(\*{0,2})(カテゴリ|記事日付|要約|配信適性|センシティブ|炎上|ソース|URL|Source|source)[：:*]/i;

  for (let i = 0; i < lines.length && topicCount < 15; i++) {
    const line = lines[i].trim();

    // フィールドラベル行は先にスキップ（タイトル行として誤検出しない）
    if (FIELD_LABEL_RE.test(line)) {
      // カテゴリ行のみ別途処理
      if (line.match(/^(\*{0,2})カテゴリ[：:*]/)) {
        const catMatch = line.replace(/.*カテゴリ[：:*]+\*{0,2}\s*/, '').replace(/[\[\]\*]/g, '').trim();
        if (catMatch && currentTopic.title) {
          (currentTopic as any)._gptCategory = catMatch;
        }
      }
      // 記事日付行: 「記事日付: YYYY-MM-DD」のテキスト部分をpublishedAtに設定
      else if (line.match(/^(\*{0,2})記事日付[：:*]/) && currentTopic.title) {
        const dateContent = line.replace(/^(\*{0,2})記事日付[：:*]+\s*\*{0,2}\s*/, '').trim();
        if (dateContent) {
          (currentTopic as any).publishedAt = dateContent;
        }
      }
      // 要約行: 「要約: テキスト」のテキスト部分をsummaryに追加
      else if (line.match(/^(\*{0,2})要約[：:*]/) && currentTopic.title) {
        const summaryContent = line.replace(/^(\*{0,2})要約[：:*]+\s*\*{0,2}\s*/, '').trim();
        if (summaryContent) {
          // 「要約:」ラベル後のテキストをsummaryとして設定（上書き優先）
          currentTopic.summary = summaryContent;
        }
      }
      continue;
    }

    // ★Bug 1修正: タイトル行は「数字. **タイトル**」形式のみ許可
    // 「**カテゴリ: ニュース**」のような行を絶対にタイトルと判定しない
    const isNumberedTitleLine = line.match(/^\d+\.\s*\*\*(.+)\*\*/);

    if (isNumberedTitleLine) {
      // 前のトピックが完了していれば保存
      if (currentTopic.title) {
        finalizeAndAddTopic(currentTopic, topics, annotations, topicCount);
        topicCount++;
      }

      // 新しいトピック開始（**で囲まれたタイトル部分を抽出）
      let title = line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
      // タイトルが短すぎる場合（5文字未満）はパース成果物の可能性があるのでスキップ
      if (title.length < 5) {
        if (DEBUG) console.warn(`[WARN] タイトルが短すぎるためスキップ: "${title}"`);
        currentTopic = {};
        continue;
      }
      // タイトル切り捨ては50文字超のみ（短すぎる制限を緩和）
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      currentTopic = {
        id: `topic-${Date.now()}-${topicCount}`,
        title: title,
        summary: '',
        createdAt: new Date().toISOString()
      };
    }
    // カテゴリ行を検出（ラベルなしインデント行パターン: 「- カテゴリ: XXX」）
    else if (line.match(/^-\s*カテゴリ[：:]\s*/) && currentTopic.title) {
      const catMatch = line.replace(/^-\s*カテゴリ[：:]\s*/, '').replace(/[\[\]]/g, '').trim();
      if (catMatch) {
        (currentTopic as any)._gptCategory = catMatch;
      }
    }
    // 記事日付行（インデント行パターン: 「- 記事日付: YYYY-MM-DD」）
    else if (line.match(/^-\s*記事日付[：:]\s*/) && currentTopic.title) {
      const dateContent = line.replace(/^-\s*記事日付[：:]\s*/, '').trim();
      if (dateContent) {
        (currentTopic as any).publishedAt = dateContent;
      }
    }
    // 要約行（ラベルなしインデント行パターン: 「- 要約: XXX」）
    else if (line.match(/^-\s*要約[：:]\s*/) && currentTopic.title) {
      const summaryContent = line.replace(/^-\s*要約[：:]\s*/, '').trim();
      if (summaryContent) {
        currentTopic.summary = summaryContent;
      }
    }
    // 配信適性行はsummaryには含めない
    else if (line.match(/^-\s*配信適性[：:]/)) {
      // 無視
    }
    // 説明行を検出（summary補完）
    else if (line && !line.match(/^[\s]*$/) && currentTopic.title) {
      // ダッシュ始まりでラベルがない行のみsummaryに追加
      const cleaned = line.replace(/^-\s*/, '').trim();
      if (cleaned) {
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

  // タイトルが短すぎるトピック（パースアーティファクト）を除去
  const validTopics = topics.filter(t => {
    if (t.title.length < 5) {
      if (DEBUG) console.warn(`[WARN] 最終フィルタでスキップ（タイトル短すぎ）: "${t.title}"`);
      return false;
    }
    return true;
  });

  // 重複除去（タイトル類似度）
  const seen = new Set();
  const unique = validTopics.filter(t => {
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
  let gptCat = (topic as any)._gptCategory?.trim();
  // GPTが返す揺れに対応（部分一致でマッチ）
  if (gptCat && !validCategories.includes(gptCat)) {
    const matched = validCategories.find(vc => gptCat!.includes(vc) || vc.includes(gptCat!));
    if (matched) gptCat = matched;
  }
  const guessed = guessCategory(topic.title, topic.summary || '');
  const category = (gptCat && validCategories.includes(gptCat)) ? gptCat : guessed;
  if (typeof console !== 'undefined') console.log('[DEBUG] title:', topic.title, '| gptCat:', gptCat, '| guessed:', guessed, '| final:', category);
  
  // 要約のクリーニング＆長さ調整
  // summaryが空の場合はテンプレートに頼らず空文字列のまま（フロントで「取得中」などを表示）
  let summary = (topic.summary && topic.summary.trim().length > 0)
    ? topic.summary
    : '';
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
  
  // 記事日付の正規化
  const rawPublishedAt = (topic as any).publishedAt;
  const publishedAt = rawPublishedAt && rawPublishedAt !== '不明' ? rawPublishedAt : undefined;

  topics.push({
    id: topic.id!,
    title: topic.title,
    category,
    summary,
    sensitivityLevel,
    riskLevel: sensitivityLevel >= 3 ? 'high' : sensitivityLevel >= 2 ? 'medium' : 'low',
    sourceUrl: annotations[index % annotations.length]?.url || 'https://news.example.com',
    publishedAt,
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
 * 台本オブジェクトの全テキストフィールドにサニタイズを適用
 * contentオブジェクト内の文字列・配列を再帰的に処理する
 */
function sanitizeScriptContent(script: Script): Script {
  // contentの各フィールドをサニタイズ
  const sanitizedContent: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(script.content as Record<string, unknown>)) {
    if (typeof value === 'string') {
      sanitizedContent[key] = sanitizeScript(value);
    } else if (Array.isArray(value)) {
      // 配列要素（viewerQuestions, expansions等）も対象
      sanitizedContent[key] = value.map(item =>
        typeof item === 'string' ? sanitizeScript(item) : item
      );
    } else {
      sanitizedContent[key] = value;
    }
  }

  return {
    ...script,
    content: sanitizedContent as Script['content'],
  };
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
 * API使用統計（リアルタイムトラッキング、1日100回制限）
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
    requestsLimit: 100,
    estimatedCost: usageTracker.estimatedCost,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
  };
}