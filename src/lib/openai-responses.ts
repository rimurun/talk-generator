import { Topic, Script, FilterOptions } from '@/types';
import { memoryCache, createTopicsCacheKey, createScriptCacheKey } from './cache';
import { filterTopics, sanitizeScript } from './content-moderation';
import { fetchGNews } from './gnews';
import { fetchXTrends } from './x-trends';

// ===========================================================
// Perplexity Sonar API 設定（トピック生成用）
// ===========================================================

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'sonar';

// OpenAI Chat Completions API 設定（台本生成用）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

const DEBUG = process.env.NODE_ENV !== 'production';

// コスト計算用
const PERPLEXITY_COST_PER_1M_TOKENS = 1.00; // Sonar: $1/1M (入出力同額)
const OPENAI_COST_PER_1M_INPUT_TOKENS = 0.15;
const OPENAI_COST_PER_1M_OUTPUT_TOKENS = 0.60;

// ===========================================================
// Perplexity Sonar API 型定義
// ===========================================================

interface PerplexityRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  search_recency_filter?: 'hour' | 'day' | 'week' | 'month';
  search_domain_filter?: string[];
  web_search_options?: {
    search_context_size?: string;
    user_location?: { country: string };
  };
  response_format?: {
    type: 'json_schema';
    json_schema: { name: string; schema: Record<string, unknown> };
  };
}

interface PerplexitySearchResult {
  title: string;
  url: string;
  date?: string;
  last_updated?: string;
  snippet?: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: { content: string; role: string };
    finish_reason: string;
  }>;
  citations?: string[];
  search_results?: PerplexitySearchResult[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

// Perplexity JSON Mode用スキーマ
const TOPIC_JSON_SCHEMA = {
  name: 'topics_response',
  schema: {
    type: 'object' as const,
    properties: {
      topics: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            category: {
              type: 'string' as const,
              enum: ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ', '事件事故'],
            },
            summary: { type: 'string' as const },
            publishedAt: { type: 'string' as const },
            talkingPoint: { type: 'string' as const },
          },
          required: ['title', 'category', 'summary', 'publishedAt', 'talkingPoint'],
        },
      },
    },
    required: ['topics'],
  },
};

// カテゴリ別の検索鮮度設定
const CATEGORY_RECENCY: Record<string, 'hour' | 'day' | 'week'> = {
  'ニュース': 'day',
  'エンタメ': 'day',
  'SNS': 'day',
  'TikTok': 'week',
  '海外おもしろ': 'week',
  '事件事故': 'day',
};

// ===========================================================
// トピック生成（Perplexity Sonar API）
// ===========================================================

/**
 * Perplexity Sonar APIを使用してトピックを生成
 */
export async function generateTopicsWithWebSearch(filters: FilterOptions, previousTitles?: string[], options?: {
  /** 生成するトピック数（デフォルト15） */
  topicCount?: number;
  /** 事前取得した外部APIコンテキスト（並列実行時の重複フェッチ回避用） */
  preloadedContext?: string;
}): Promise<{
  topics: Topic[];
  cost: number;
  cached: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
}> {
  const cacheKey = createTopicsCacheKey(filters);
  const hasPreviousTitles = previousTitles && previousTitles.length > 0;

  // キャッシュチェック（前回タイトルがある場合はスキップ）
  if (!hasPreviousTitles) {
    let cachedTopics = memoryCache.getTopics(cacheKey);
    if (!cachedTopics) {
      cachedTopics = await memoryCache.getTopicsFromDb(cacheKey);
    }
    if (cachedTopics) {
      if (DEBUG) console.log('トピックキャッシュヒット（完全一致）');
      trackUsage(0, 0, true);
      return { topics: cachedTopics, cost: 0, cached: true, cacheHitType: 'exact' };
    }

    const fuzzyMatch = memoryCache.getTopicsFuzzy(filters);
    if (fuzzyMatch && fuzzyMatch.similarity >= 0.80) {
      if (DEBUG) console.log(`トピックキャッシュヒット（ファジー: ${Math.round(fuzzyMatch.similarity * 100)}%）`);
      trackUsage(0, 0, true);
      return { topics: fuzzyMatch.data, cost: 0, cached: true, cacheHitType: 'fuzzy' };
    }
  }

  if (!PERPLEXITY_API_KEY) {
    console.warn('PERPLEXITY_API_KEY が未設定、フォールバックトピックを使用');
    return { topics: generateFallbackTopics(filters), cost: 0, cached: false };
  }

  // 生成トピック数（並列モード時は少なめに）
  const topicCount = options?.topicCount || 15;

  // GNews / X APIからコンテキストデータを取得（事前取得データがあればスキップ）
  let externalContext = options?.preloadedContext || '';
  if (!externalContext) {
    const targetCategories = filters.categories.length > 0
      ? filters.categories
      : ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];
    const needsNews = targetCategories.some(c => c === 'ニュース' || c === 'エンタメ');
    const needsSns = targetCategories.some(c => c === 'SNS' || c === 'TikTok');

    const [gnewsData, xTrendsData] = await Promise.all([
      needsNews ? fetchGNews().catch(() => ({ japan: [], entertainment: [] })) : Promise.resolve({ japan: [], entertainment: [] }),
      needsSns ? fetchXTrends().catch(() => []) : Promise.resolve([]),
    ]);

    if (gnewsData.japan.length > 0 && targetCategories.includes('ニュース')) {
      externalContext += '\n【参考：最新ニュース（GNews）】\n' +
        gnewsData.japan.slice(0, 5).map(a => `- ${a.title}（${a.publishedAt?.slice(0, 10) || ''}）`).join('\n');
    }
    if (gnewsData.entertainment.length > 0 && targetCategories.includes('エンタメ')) {
      externalContext += '\n【参考：最新エンタメ（GNews）】\n' +
        gnewsData.entertainment.slice(0, 5).map(a => `- ${a.title}（${a.publishedAt?.slice(0, 10) || ''}）`).join('\n');
    }
    if (xTrendsData.length > 0 && (targetCategories.includes('SNS') || targetCategories.includes('TikTok'))) {
      externalContext += '\n【参考：X(Twitter)リアルタイムトレンド】\n' +
        xTrendsData.slice(0, 10).map(t => `- ${t.name}${t.tweetCount ? `（${t.tweetCount.toLocaleString()}件）` : ''}`).join('\n');
    }
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (DEBUG) console.log(`Perplexity Sonar トピック生成 試行 ${attempt}/${maxRetries}`);

      const now = new Date();
      const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
      const timeContext = now.getHours() < 12 ? '朝' : now.getHours() < 18 ? '昼' : '夜';

      // カテゴリ別検索クエリ
      const categoryQueries: Record<string, string> = {
        'ニュース': `${todayStr} 日本 最新ニュース 速報 政治 経済 社会 テクノロジー`,
        'エンタメ': `${todayStr} エンタメ 最新 アニメ 映画 音楽 芸能 ゲーム 話題`,
        'SNS': `${todayStr} SNS トレンド Twitter X Instagram YouTube バズ 話題`,
        'TikTok': `${todayStr} TikTok バズ チャレンジ トレンド 日本 海外`,
        '海外おもしろ': `${todayStr} 海外 おもしろニュース 珍事件 珍ニュース 面白い ユニーク 衝撃`,
        '事件事故': `${todayStr} 事件 事故 速報 最新ニュース 逮捕 火災 災害 日本`,
      };

      // 検索クエリ選択
      const searchQueries = filters.categories.length > 0
        ? filters.categories.map(cat => categoryQueries[cat] || '').filter(Boolean)
        : Object.values(categoryQueries);

      // フリーワードキーワード
      const keyword = (filters as any).keyword?.trim();

      // カテゴリフィルター文字列
      const categoryFilter = filters.categories.length > 0
        ? `カテゴリ指定: ${filters.categories.join(', ')}`
        : '全カテゴリ（バランス重視）';

      // 許可カテゴリ
      const allowedCategories = filters.categories.length > 0
        ? filters.categories
        : ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ', ...((filters.includeIncidents || filters.categories.includes('事件事故')) ? ['事件事故'] : [])];

      // 単一カテゴリ指示
      const singleCategoryInstruction = filters.categories.length === 1
        ? `【重要】すべてのトピックのカテゴリは「${filters.categories[0]}」にしてください。他のカテゴリは生成禁止。`
        : '';

      // recency設定（ユーザーの期間選択を優先、未指定ならカテゴリ別デフォルト）
      const timePeriodToRecency: Record<string, 'day' | 'week' | 'month'> = {
        'today': 'day',
        'week': 'week',
        'month': 'month',
      };
      const userRecency = (filters as any).timePeriod
        ? timePeriodToRecency[(filters as any).timePeriod] || 'day'
        : undefined;
      const recency = userRecency
        || (filters.categories.length === 1 ? (CATEGORY_RECENCY[filters.categories[0]] || 'day') : 'day');

      // システムプロンプト
      const systemPrompt = `配信者向けトーク台本生成AIです。日本のリアルタイムトレンドをWeb検索で取得し、JSON形式で返します。
必ずcategoryフィールドに正しいカテゴリ名を設定してください。許可されるカテゴリ: ${allowedCategories.join('/')}
publishedAtは記事の公開日をYYYY-MM-DD形式で。不明なら空文字にしてください。

【重要：summaryの品質】
summaryは配信者がこの話題を十分に把握できる詳しさで書くこと。
- 何が起きたか（事実）
- なぜ起きたか（背景・経緯）
- どんな影響があるか（今後の展開・世間の反応）
を含めて150〜250字程度で説明する。「〜と報じられた」のような1行要約は禁止。
配信者がこのsummaryだけ読めば視聴者の質問にも答えられるレベルにすること。

【重要：talkingPoint（配信切り口）】
talkingPointは「この話題を配信でどう切り出すか」の1行ヒント（30〜50字）。
視聴者がコメントしたくなる問いかけや、意外性のある切り口を書く。
例: 「これ月収いくらなら許せる？視聴者に聞いてみて」
例: 「実はこの技術、みんなのスマホにも入ってる」

【カテゴリ別の必須情報】
- ニュース: 必ず具体的な数字（金額・人数・日時）を含める
- エンタメ: 作品名・出演者名・公開日や放送日を必ず記載
- SNS: ハッシュタグ名・バズった投稿の具体的内容・なぜバズったか
- TikTok: 動画の内容説明・再生数やいいね数・チャレンジ名・使用音楽
- 海外おもしろ: 国名・具体的なエピソード描写・現地の反応やオチ
- 事件事故: 5W1H完備・被害状況・捜査状況・注意喚起`;

      // 期間に応じた鮮度指示
      const freshnessMap: Record<string, string> = {
        'day': '直近24〜48時間以内に報道・投稿された話題のみ',
        'week': '直近1週間以内に報道・投稿された話題のみ',
        'month': '直近1ヶ月以内に報道・投稿された話題のみ',
      };
      const freshnessInstruction = freshnessMap[recency] || freshnessMap['day'];

      // ユーザープロンプト
      const userPrompt = `${todayStr}${timeContext}の配信ネタを生成してください。
【鮮度厳守】${freshnessInstruction}。古いニュースは絶対に含めないこと。
検索ヒント: ${searchQueries.slice(0, 3).join(' / ')}
${categoryFilter}${keyword ? `\nキーワード: ${keyword}` : ''}
${(filters.includeIncidents || filters.categories.includes('事件事故')) ? '' : '事件事故は除外。'}テンション: ${filters.tension}
${singleCategoryInstruction}
${externalContext ? `\n以下は外部APIから取得した最新データです。これらを参考にしつつ、Web検索で詳細を補完してトピックを生成してください。${externalContext}` : ''}

${filters.categories.length !== 1 ? `各カテゴリから均等に生成してください。` : ''}
${topicCount}件生成してください。各トピックのtitle(50字以内)・category・summary(背景・経緯・影響を含む150-250字)・publishedAt(YYYY-MM-DD)・talkingPoint(配信での切り口30-50字)を含めてください。
${previousTitles && previousTitles.length > 0 ? `除外（既出）: ${previousTitles.slice(0, 10).join(', ')}` : ''}`;

      // Perplexity Sonar APIリクエスト
      // トピック数に応じてトークン量とタイムアウトを調整
      const maxTokens = topicCount <= 7 ? 2000 : 3000;
      const timeoutMs = topicCount <= 7 ? 30000 : 40000;

      const requestBody: PerplexityRequest = {
        model: PERPLEXITY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.5,
        search_recency_filter: recency,
        web_search_options: {
          search_context_size: 'high',
          user_location: { country: 'JP' },
        },
        response_format: {
          type: 'json_schema',
          json_schema: TOPIC_JSON_SCHEMA,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(PERPLEXITY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
          const delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
          console.log(`Perplexity 429 - ${delay}ms後にリトライ (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        if (response.status === 401) {
          throw new Error('Perplexity API: 認証エラー（APIキーを確認してください）');
        }
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Perplexity API Error: ${response.status} ${response.statusText}`);
      }

      const data: PerplexityResponse = await response.json();
      const content = data.choices[0]?.message?.content || '';
      const searchResults = data.search_results || [];
      const citations = data.citations || [];

      // JSONパース
      let rawTopics: Array<{ title: string; category: string; summary: string; publishedAt: string; talkingPoint?: string }> = [];
      try {
        const parsed = JSON.parse(content);
        rawTopics = parsed.topics || [];
      } catch (parseError) {
        console.error('Perplexity JSON パースエラー:', parseError);
        // テキストからJSONブロックを抽出して再試行
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            rawTopics = parsed.topics || [];
          } catch {
            console.error('JSONブロック抽出も失敗');
          }
        }
      }

      if (rawTopics.length === 0) {
        throw new Error('Perplexity API: トピックが0件');
      }

      // 有効なカテゴリリスト
      const validCategories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ', '事件事故'];

      // Topic[]にマッピング
      const topicsData: Topic[] = rawTopics.map((raw, index) => {
        // search_resultsからタイトル類似度でマッチング → URL・日付を取得
        const matchedResult = searchResults.find(sr =>
          sr.title && calculateSimilarity(sr.title, raw.title) > 0.3
        );

        // カテゴリバリデーション
        const category = validCategories.includes(raw.category)
          ? raw.category as Topic['category']
          : guessSensitivityLevel(raw.title, raw.summary) >= 3 ? '事件事故' as const : 'ニュース' as const;

        // publishedAt: JSON出力 > search_results.date > undefined
        const publishedAt = (raw.publishedAt && raw.publishedAt.match(/^\d{4}-\d{2}-\d{2}/))
          ? raw.publishedAt.slice(0, 10)
          : (matchedResult?.date?.slice(0, 10) || undefined);

        return {
          id: `topic-${Date.now()}-${index}`,
          title: raw.title.slice(0, 50),
          category,
          summary: raw.summary.slice(0, 400),
          sensitivityLevel: guessSensitivityLevel(raw.title, raw.summary),
          riskLevel: guessSensitivityLevel(raw.title, raw.summary) >= 3 ? 'high' as const
            : guessSensitivityLevel(raw.title, raw.summary) >= 2 ? 'medium' as const : 'low' as const,
          sourceUrl: matchedResult?.url || citations[index] || 'https://news.example.com',
          publishedAt,
          talkingPoint: raw.talkingPoint?.slice(0, 80) || undefined,
          createdAt: new Date().toISOString(),
        };
      });

      // 後処理
      let processedTopics = removeDuplicateTopics(topicsData);

      // includeIncidentsフィルタ（カテゴリで事件事故を明示選択している場合は除外しない）
      const incidentsExplicitlySelected = filters.categories.includes('事件事故');
      if (!filters.includeIncidents && !incidentsExplicitlySelected) {
        processedTopics = processedTopics.filter(t => t.category !== '事件事故');
      }

      // カテゴリバランス調整
      processedTopics = balanceTopicCategories(processedTopics);

      // previousTitlesとの重複除去
      if (previousTitles && previousTitles.length > 0) {
        processedTopics = processedTopics.filter(topic => {
          return !previousTitles.some(prevTitle =>
            calculateSimilarity(topic.title, prevTitle) > 0.5
          );
        });
      }

      // NGワードフィルタ
      const { filtered } = filterTopics(processedTopics);
      processedTopics = filtered;

      // コスト計算
      const usage = data.usage;
      let cost = 0;
      if (usage) {
        const totalTokens = usage.prompt_tokens + usage.completion_tokens;
        cost = (totalTokens / 1_000_000) * PERPLEXITY_COST_PER_1M_TOKENS;
      }
      const totalTokens = usage ? (usage.prompt_tokens + usage.completion_tokens) : 0;
      trackUsage(totalTokens, cost, false);

      // キャッシュ保存
      memoryCache.setTopics(cacheKey, processedTopics);

      return {
        topics: processedTopics.slice(0, 15),
        cost,
        cached: false,
      };

    } catch (error: any) {
      lastError = error;
      if (error.name === 'AbortError') {
        console.error(`Perplexity タイムアウト (試行 ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) continue;
      }
      if (attempt < maxRetries && !error.message?.includes('認証エラー')) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // 全リトライ失敗 → フォールバック
  console.error('Perplexity API 全リトライ失敗:', lastError?.message);
  const fallbackTopics = generateFallbackTopics(filters);
  return { topics: fallbackTopics, cost: 0, cached: false };
}

/**
 * 外部APIコンテキストを事前取得（並列実行時の重複フェッチ回避用）
 * route.ts から1回だけ呼び出し、各カテゴリの generateTopicsWithWebSearch に渡す
 */
export async function buildExternalContext(categories: string[]): Promise<string> {
  const needsNews = categories.some(c => c === 'ニュース' || c === 'エンタメ');
  const needsSns = categories.some(c => c === 'SNS' || c === 'TikTok');

  const [gnewsData, xTrendsData] = await Promise.all([
    needsNews ? fetchGNews().catch(() => ({ japan: [], entertainment: [] })) : Promise.resolve({ japan: [], entertainment: [] }),
    needsSns ? fetchXTrends().catch(() => []) : Promise.resolve([]),
  ]);

  let context = '';
  if (gnewsData.japan.length > 0) {
    context += '\n【参考：最新ニュース（GNews）】\n' +
      gnewsData.japan.slice(0, 5).map(a => `- ${a.title}（${a.publishedAt?.slice(0, 10) || ''}）`).join('\n');
  }
  if (gnewsData.entertainment.length > 0) {
    context += '\n【参考：最新エンタメ（GNews）】\n' +
      gnewsData.entertainment.slice(0, 5).map(a => `- ${a.title}（${a.publishedAt?.slice(0, 10) || ''}）`).join('\n');
  }
  if (xTrendsData.length > 0) {
    context += '\n【参考：X(Twitter)リアルタイムトレンド】\n' +
      xTrendsData.slice(0, 10).map(t => `- ${t.name}${t.tweetCount ? `（${t.tweetCount.toLocaleString()}件）` : ''}`).join('\n');
  }
  return context;
}

// ===========================================================
// テンション別の演出ルール生成
// ===========================================================

function buildTensionInstruction(tension: 'low' | 'medium' | 'high'): string {
  switch (tension) {
    case 'low':
      return `【テンション: 低め（落ち着き重視）】
- ゆったりとした語り口。急がず、間を取りながら話す
- 感嘆詞（！）は最小限。「。」で区切る静かなリズム
- 大袈裟な表現・煽りは禁止。「すごい」「やばい」等の強調語は控える
- 例: 「さて、こんな話があるんだけど」「ふーん、なるほどね」「ちょっと気になったんだよね」
- 視聴者への問いかけも穏やかに: 「どう思う？」「知ってた？」`;

    case 'high':
      return `【テンション: 高め（盛り上げ重視）】
- 勢いとエネルギーのある話し方。テンポ速め
- 感嘆詞・強調表現を積極的に使用: 「マジで！」「やばくない！？」「えー！」「うそでしょ！」
- リアクション大きめ。驚き・興奮・笑いを全面に出す
- 例: 「ちょっと聞いてこれ！マジでやばいから！」「いやいやいや待って待って！」
- 視聴者を煽る問いかけ: 「これ知ってるやつおる！？」「コメントで教えて！」`;

    case 'medium':
    default:
      return `【テンション: 中（バランス）】
- 自然体の配信トーン。盛り上がる場面と落ち着く場面のメリハリをつける
- 適度に感嘆詞を使いつつ、過剰にならない
- 例: 「これ結構面白くて」「おー、なるほどね」「ちょっと気になるよね」`;
  }
}

// ===========================================================
// 口調別の文体ルール生成
// ===========================================================

function buildToneInstruction(tone: string): string {
  const lower = tone.toLowerCase();

  if (lower === 'ため口' || lower === 'タメ口' || lower === 'ため口' || lower.includes('タメ')) {
    return `- 「です」「ます」「ございます」等の敬語・丁寧語は一切使用禁止
- 語尾は「〜だよ」「〜じゃん」「〜だろ」「〜だね」「〜かな」「〜っしょ」「〜だわ」等のカジュアル表現を使う
- 例: 「これマジでやばいんだけど」「知ってた？」「めっちゃ面白くない？」「ちょっと聞いてよ」
- 視聴者への呼びかけも「みんな」「おまえら」「お前ら」等のカジュアルな表現
- 「〜してください」→「〜してみて」、「〜と思います」→「〜と思う」「〜だと思うわ」
- 全体を通して友達に話しかけるような砕けた口調を徹底すること`;
  }

  if (lower === 'フレンドリー' || lower.includes('フレンドリー')) {
    return `- 丁寧語ベースだが堅すぎない「〜ですね」「〜なんですよ」等の親しみやすい表現
- 例: 「これ、すごくないですか？」「実はね、こんなことがあったんですよ」
- 適度にカジュアルな表現を混ぜてOK`;
  }

  if (lower === 'エネルギッシュ' || lower.includes('エネルギッシュ')) {
    return `- テンション高め、勢いのある話し方
- 例: 「はいどうもー！」「これヤバいっすよ！」「マジで！？って感じですよね！」
- 感嘆詞や強調表現を多用、テンポよく`;
  }

  if (lower === '落ち着いた' || lower.includes('落ち着')) {
    return `- 穏やかで知的な話し方、丁寧語ベース
- 例: 「さて、今日はこちらの話題を取り上げてみましょう」「興味深いですね」
- 急がず、間を大切にした語り口`;
  }

  if (lower === 'コメディ重視' || lower.includes('コメディ')) {
    return `- ボケやツッコミを随所に入れる、笑いを取りに行く話し方
- 例: 「いやいやいや、ちょっと待って」「なんでやねん」「それはさすがに草」
- 自虐やオーバーリアクションもOK`;
  }

  if (lower === '事実重視' || lower.includes('事実')) {
    return `- 客観的で淡々とした報道調。丁寧語を使うが感情は控えめ
- 例: 「こちらの件について、現時点での情報をお伝えします」
- 個人的意見は最小限、データや事実を中心に構成`;
  }

  if (lower === 'バランス重視' || lower.includes('バランス')) {
    return `- 敬語とカジュアルを適度に混ぜた自然な配信スタイル
- 例: 「今日はこの話題いきましょう！結構面白いんですよこれが」
- 硬すぎず砕けすぎずの中間`;
  }

  // カスタム口調（プリセット外）
  return `- 「${tone}」の口調で一貫して書くこと
- 指定された口調の特徴を全セクションで維持すること`;
}

// ===========================================================
// 台本プロンプト構築（共通ヘルパー）
// ===========================================================

interface ScriptTopicInput {
  id: string;
  title: string;
  category: 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' | '事件事故';
  summary: string;
  sensitivityLevel: 1 | 2 | 3;
  riskLevel: 'low' | 'medium' | 'high';
}

function buildScriptPrompts(
  topic: ScriptTopicInput,
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string,
  styleProfile?: string
): { systemPrompt: string; userPrompt: string; maxTokens: number } {
  const maxTokens = duration === 15 ? 500 : duration === 60 ? 1000 : 2000;
  const targetChars = duration === 15 ? 100 : duration === 60 ? 400 : 1200;

  const toneInstruction = buildToneInstruction(tone);
  const tensionInstruction = buildTensionInstruction(tension);

  let systemPrompt = `配信者向け台本作成。配信者がテレプロンプターで読み上げる台本を書くこと。
尺: ${duration}秒(約${targetChars}文字)

${tensionInstruction}

【口調の絶対ルール】口調: 「${tone}」
${toneInstruction}
※ 上記のテンション+口調ルールは全セクションに適用すること。指定外の文体・テンションは使用禁止。

${topic.category === '事件事故'
  ? `事件事故モード: 煽り・断定・憶測は禁止だが、棒読みの資料ではなく配信者が自然に読み上げられる語り口調で書くこと。
- factualReport: 語りかけ調で事実を伝える（約${Math.floor(targetChars * 0.4)}字）
- seriousContext: 背景や影響を配信者の言葉で説明。視聴者に考えてもらう問いかけも含める（約${Math.floor(targetChars * 0.35)}字）
- avoidanceNotes: 注意喚起で自然に締める（約${Math.floor(targetChars * 0.25)}字）
JSON返答のみ。`
  : `通常モード: 配信者が実際に声に出して読む台本として書くこと。「えー」「なんと」等の自然な間も入れてよい。
- opening: 視聴者への挨拶と話題への導入
- explanation: 話題の詳しい説明（約${Math.floor(targetChars * 0.4)}字）
- streamerComment: 配信者としての率直な感想・意見（約${Math.floor(targetChars * 0.3)}字）
- viewerQuestions: 視聴者に振る質問3つ（コメント欄が盛り上がる問いかけ）
- expansions: 話を広げられる関連トピック3件
- transition: 次の話題への自然な繋ぎ
JSON返答のみ。`
}`;

  if (styleProfile) {
    systemPrompt += `\n\n${styleProfile}`;
  }

  const userPrompt = `以下のトピック情報に基づいて台本を作成してください:

【トピック詳細】
- タイトル: ${topic.title}
- カテゴリ: ${topic.category}
- 要約: ${topic.summary}
- センシティブ度: ${topic.sensitivityLevel}/3
- 炎上リスク: ${topic.riskLevel}

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

  return { systemPrompt, userPrompt, maxTokens };
}

// ===========================================================
// キャッシュチェック共通ヘルパー
// ===========================================================

async function checkScriptCache(
  topicId: string, duration: 15 | 60 | 180, tension: string, tone: string
): Promise<{ script: Script; cacheHitType: 'exact' | 'fuzzy' } | null> {
  const cacheKey = createScriptCacheKey(topicId, duration, tension, tone);

  let cachedScript = memoryCache.getScript(cacheKey);
  if (!cachedScript) {
    cachedScript = await memoryCache.getScriptFromDb(cacheKey);
  }
  if (cachedScript) {
    if (DEBUG) console.log('台本キャッシュヒット（完全一致）');
    trackUsage(0, 0, true);
    return { script: cachedScript, cacheHitType: 'exact' };
  }

  const fuzzyMatch = memoryCache.getScriptFuzzy(topicId, duration, tension, tone);
  if (fuzzyMatch) {
    if (DEBUG) console.log(`台本キャッシュヒット（ファジー: ${fuzzyMatch.baseKey}）`);
    trackUsage(0, 0, true);
    return { script: fuzzyMatch.data, cacheHitType: 'fuzzy' };
  }

  return null;
}

// ===========================================================
// 台本生成（OpenAI Chat Completions API — 非ストリーミング）
// ===========================================================

export async function generateScriptWithCache(
  topic: ScriptTopicInput,
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string,
  styleProfile?: string
): Promise<{
  script: Script;
  cost: number;
  cached: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
}> {
  const cached = await checkScriptCache(topic.id, duration, tension, tone);
  if (cached) {
    return { script: cached.script, cost: 0, cached: true, cacheHitType: cached.cacheHitType };
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  try {
    const { systemPrompt, userPrompt, maxTokens } = buildScriptPrompts(topic, duration, tension, tone, styleProfile);

    const maxRetries = 3;
    let data: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await fetch(OPENAI_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.6,
        }),
      });

      if (response.ok) {
        data = await response.json();
        break;
      }

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        const delay = retryAfter > 0 ? retryAfter * 1000 : attempt * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
    }

    if (!data) {
      throw new Error('OpenAI API: 最大リトライ回数を超えました');
    }

    let scriptData: Script;
    try {
      const messageContent = data.choices[0]?.message?.content || '';
      const cleanedMessage = messageContent.replace(/```json\s*|\s*```/g, '').trim();
      scriptData = JSON.parse(cleanedMessage);
      if (!scriptData.content || typeof scriptData.content !== 'object') {
        throw new Error('Invalid script structure');
      }
    } catch {
      scriptData = createFallbackScript(topic, duration, tension, tone);
    }

    const usage = data.usage;
    let cost = 0;
    if (usage) {
      cost = (usage.prompt_tokens / 1_000_000) * OPENAI_COST_PER_1M_INPUT_TOKENS
           + (usage.completion_tokens / 1_000_000) * OPENAI_COST_PER_1M_OUTPUT_TOKENS;
    }
    const totalTokens = usage ? (usage.prompt_tokens + usage.completion_tokens) : 0;
    trackUsage(totalTokens, cost, false);

    const safeScriptData = sanitizeScriptContent(scriptData);
    memoryCache.setScript(createScriptCacheKey(topic.id, duration, tension, tone), safeScriptData);

    return { script: safeScriptData, cost, cached: false };

  } catch (error: any) {
    console.error('台本生成エラー:', error?.message);
    throw error;
  }
}

// ===========================================================
// 台本生成（OpenAI Chat Completions API — SSEストリーミング）
// ===========================================================

/**
 * ストリーミング台本生成。onToken コールバックでトークンを逐次送出し、
 * 完了時にパース済み Script を返す。キャッシュヒット時は即座にスクリプトを返す。
 */
export async function generateScriptStreaming(
  topic: ScriptTopicInput,
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string,
  styleProfile: string | undefined,
  onToken: (text: string) => void
): Promise<{
  script: Script;
  cost: number;
  cached: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
}> {
  // キャッシュチェック — ヒット時はストリーミング不要
  const cached = await checkScriptCache(topic.id, duration, tension, tone);
  if (cached) {
    return { script: cached.script, cost: 0, cached: true, cacheHitType: cached.cacheHitType };
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  const { systemPrompt, userPrompt, maxTokens } = buildScriptPrompts(topic, duration, tension, tone, styleProfile);

  // OpenAI ストリーミングリクエスト（リトライ付き）
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(OPENAI_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.6,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
          const delay = retryAfter > 0 ? retryAfter * 1000 : attempt * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
      }

      // ストリーム読み取り
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let sseBuffer = '';
      let promptTokens = 0;
      let completionTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              accumulated += token;
              onToken(token);
            }
            // usage は最終チャンクに含まれる
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || 0;
              completionTokens = parsed.usage.completion_tokens || 0;
            }
          } catch {
            // 不完全なJSON行は無視
          }
        }
      }

      // 完了: JSON パースしてスクリプトを構築
      const cleaned = accumulated.replace(/```json\s*|\s*```/g, '').trim();
      let scriptData: Script;
      try {
        scriptData = JSON.parse(cleaned);
        if (!scriptData.content || typeof scriptData.content !== 'object') {
          throw new Error('Invalid script structure');
        }
      } catch {
        scriptData = createFallbackScript(topic, duration, tension, tone);
      }

      // コスト計算
      let cost = 0;
      if (promptTokens > 0 || completionTokens > 0) {
        cost = (promptTokens / 1_000_000) * OPENAI_COST_PER_1M_INPUT_TOKENS
             + (completionTokens / 1_000_000) * OPENAI_COST_PER_1M_OUTPUT_TOKENS;
      }
      const totalTokens = promptTokens + completionTokens;
      trackUsage(totalTokens, cost, false);

      const safeScriptData = sanitizeScriptContent(scriptData);
      memoryCache.setScript(createScriptCacheKey(topic.id, duration, tension, tone), safeScriptData);

      return { script: safeScriptData, cost, cached: false };

    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries && !error.message?.includes('認証エラー')) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('OpenAI API: ストリーミング生成に失敗しました');
}

// ===========================================================
// ユーティリティ関数
// ===========================================================

/** センシティブレベル推測 */
function guessSensitivityLevel(title: string, summary: string): 1 | 2 | 3 {
  const text = (title + ' ' + summary).toLowerCase();
  if (text.includes('事件') || text.includes('事故') || text.includes('死亡') ||
      text.includes('逮捕') || text.includes('火災') || text.includes('災害')) {
    return 3;
  }
  if (text.includes('問題') || text.includes('批判') || text.includes('炎上') ||
      text.includes('議論') || text.includes('論争')) {
    return 2;
  }
  return 1;
}

/** 台本サニタイズ */
function sanitizeScriptContent(script: Script): Script {
  const sanitizedContent: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(script.content as Record<string, unknown>)) {
    if (typeof value === 'string') {
      sanitizedContent[key] = sanitizeScript(value);
    } else if (Array.isArray(value)) {
      sanitizedContent[key] = value.map(item => typeof item === 'string' ? sanitizeScript(item) : item);
    } else {
      sanitizedContent[key] = value;
    }
  }
  return { ...script, content: sanitizedContent as Script['content'] };
}

/** フォールバックスクリプト生成 */
function createFallbackScript(
  topic: { id: string; title: string; category: string; summary: string },
  duration: 15 | 60 | 180, tension: 'low' | 'medium' | 'high', tone: string
): Script {
  if (topic.category === '事件事故') {
    return {
      id: `script-${topic.id}`, topicId: topic.id, duration, tension, tone,
      content: {
        factualReport: `「${topic.title}」について、現時点で公表されている情報をお伝えします。`,
        seriousContext: `${topic.summary}との報告があります。関係機関による調査が進められている状況です。`,
        avoidanceNotes: '詳細な憶測や個人的な見解については控え、正式な発表を待つことが重要です。',
      },
    };
  }
  return {
    id: `script-${topic.id}`, topicId: topic.id, duration, tension, tone,
    content: {
      opening: `こんにちは！今日は「${topic.title}」について話していきたいと思います。`,
      explanation: topic.summary,
      streamerComment: `${topic.category}の話題としては、これは結構注目すべき内容だと思います。`,
      viewerQuestions: [`${topic.title}についてどう思いますか？`, `${topic.category}関連で似た話題知ってますか？`, '今後どうなっていくと思いますか？'],
      expansions: [`${topic.category}分野の最新動向`, '関連する他のトピックとの比較', '今後の予測と影響について'],
      transition: '次の話題も面白いので続けて見ていきましょう。',
    },
  };
}

/** 重複トピック排除（Jaccard類似度） */
function removeDuplicateTopics(topics: Topic[]): Topic[] {
  const uniqueTopics: Topic[] = [];
  for (const topic of topics) {
    const isDuplicate = uniqueTopics.some(existing =>
      calculateSimilarity(topic.title, existing.title) > 0.7 ||
      topic.title === existing.title
    );
    if (!isDuplicate) uniqueTopics.push(topic);
  }
  return uniqueTopics;
}

/** 文字列類似度（バイグラムJaccard係数） */
function calculateSimilarity(str1: string, str2: string): number {
  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) bigrams.add(str.slice(i, i + 2));
    return bigrams;
  };
  const b1 = getBigrams(str1), b2 = getBigrams(str2);
  let intersection = 0;
  b1.forEach(bg => { if (b2.has(bg)) intersection++; });
  const union = b1.size + b2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** カテゴリバランス調整（各カテゴリ最大3件） */
function balanceTopicCategories(topics: Topic[]): Topic[] {
  const categories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ', '事件事故'];
  const balanced: Topic[] = [];
  for (const cat of categories) {
    balanced.push(...topics.filter(t => t.category === cat).slice(0, 3));
  }
  const remaining = topics.filter(t => !balanced.some(b => b.id === t.id));
  balanced.push(...remaining.slice(0, Math.max(0, 10 - balanced.length)));
  return balanced.slice(0, 15);
}

/** ランダムカテゴリ取得 */
function getRandomCategory(): 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ' {
  const cats: ('ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '海外おもしろ')[] = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];
  return cats[Math.floor(Math.random() * cats.length)];
}

/** フォールバックトピック生成 */
function generateFallbackTopics(filters: FilterOptions): Topic[] {
  const fallbackTopics: Topic[] = [
    { id: `fallback-${Date.now()}-1`, title: '話題のAI技術について', category: 'ニュース', summary: '最近のAI技術の進歩について配信者として感じることや視聴者の意見を聞いてみたいと思います。', sensitivityLevel: 1, riskLevel: 'low', sourceUrl: 'https://news.example.com', createdAt: new Date().toISOString() },
    { id: `fallback-${Date.now()}-2`, title: '今話題のゲーム・アニメ', category: 'エンタメ', summary: '最近リリースされたゲームや放送中のアニメで気になる作品について話してみませんか？', sensitivityLevel: 1, riskLevel: 'low', sourceUrl: 'https://entertainment.example.com', createdAt: new Date().toISOString() },
    { id: `fallback-${Date.now()}-3`, title: 'SNSで見かけた面白い話', category: 'SNS', summary: '最近SNSで話題になった面白い投稿やバズっているトピックについて雑談しましょう。', sensitivityLevel: 1, riskLevel: 'low', sourceUrl: 'https://social.example.com', createdAt: new Date().toISOString() },
    { id: `fallback-${Date.now()}-4`, title: 'TikTokの人気チャレンジ', category: 'TikTok', summary: '今TikTokで流行っているチャレンジや面白い動画についてみんなで盛り上がりましょう。', sensitivityLevel: 1, riskLevel: 'low', sourceUrl: 'https://tiktok.example.com', createdAt: new Date().toISOString() },
    { id: `fallback-${Date.now()}-5`, title: '海外で話題のユニークニュース', category: '海外おもしろ', summary: '海外で話題になっている面白い・ユニークなニュースを紹介。思わず笑ってしまう珍事件。', sensitivityLevel: 1, riskLevel: 'low', sourceUrl: 'https://foreign-funny.example.com', createdAt: new Date().toISOString() },
    { id: `fallback-${Date.now()}-6`, title: '季節の話題・イベント', category: 'ニュース', summary: '今の時期ならではの話題やこれから予定されているイベントについて話してみませんか？', sensitivityLevel: 1, riskLevel: 'low', sourceUrl: 'https://seasonal.example.com', createdAt: new Date().toISOString() },
  ];

  let filtered = fallbackTopics;
  if (filters.categories.length > 0) {
    filtered = filtered.filter(t => filters.categories.includes(t.category));
  }
  if (!filters.includeIncidents) {
    filtered = filtered.filter(t => t.category !== '事件事故');
  }
  while (filtered.length < 8) {
    filtered.push({
      id: `fallback-${Date.now()}-${filtered.length + 1}`,
      title: `配信者雑談トピック #${filtered.length + 1}`,
      category: getRandomCategory(),
      summary: '配信での雑談に使える汎用的な話題です。視聴者との交流にご活用ください。',
      sensitivityLevel: 1, riskLevel: 'low',
      sourceUrl: 'https://fallback.example.com',
      createdAt: new Date().toISOString(),
    });
  }
  return filtered;
}

// ===========================================================
// 使用量トラッカー
// ===========================================================

const usageTracker = {
  date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }),
  tokensUsed: 0, requestsUsed: 0, estimatedCost: 0, cacheHits: 0, totalRequests: 0,
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

export async function getApiUsageStats() {
  resetTrackerIfNewDay();
  const cacheHitRate = usageTracker.totalRequests > 0
    ? usageTracker.cacheHits / usageTracker.totalRequests : 0;
  return {
    tokensUsed: usageTracker.tokensUsed,
    tokensLimit: 100000,
    requestsUsed: usageTracker.requestsUsed,
    requestsLimit: 100,
    estimatedCost: usageTracker.estimatedCost,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
  };
}
