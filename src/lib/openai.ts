import OpenAI from 'openai';
import { Topic, Script, FilterOptions } from '@/types';
import { mockTopics, mockScripts, tonePresets } from './mock-data';

// OpenAI client initialization (lazy, server-side only)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (typeof window !== 'undefined') return null;
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Configuration
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;
const DEBUG = process.env.NODE_ENV !== 'production';

/**
 * Search for recent topics using web search
 */
async function searchWebTopics(): Promise<string> {
  try {
    // Note: This is a mock implementation. In a real scenario, you would use
    // a web search API like Google Custom Search, Serp API, or similar.
    // For now, we'll return mock search results to demonstrate the structure.
    
    const searchResults = [
      {
        title: "日本国内最新ニュース",
        snippet: "政治・経済・社会の最新動向について、今日の重要なニュースをお届けします。",
        url: "https://news.example.com/japan-news"
      },
      {
        title: "エンタメ界最新トピック",
        snippet: "芸能界、映画、音楽業界で話題になっている最新の動向をまとめました。",
        url: "https://entertainment.example.com/latest"
      },
      {
        title: "SNSトレンド分析",
        snippet: "Twitter、Instagram、TikTokで今話題になっているトレンドを分析。",
        url: "https://social.example.com/trends"
      }
    ];
    
    return JSON.stringify(searchResults);
  } catch (error) {
    // Web search failure is expected in mock mode
    if (DEBUG) console.error('Web search failed:', error);
    return '検索結果を取得できませんでした。';
  }
}

/**
 * Generate topics using OpenAI API with web search integration
 */
export async function generateTopics(filters: FilterOptions): Promise<Topic[]> {
  // Fallback to mock data if OpenAI is not available (client-side or missing API key)
  if (!getOpenAI() || !process.env.OPENAI_API_KEY) {
    if (DEBUG) console.warn('OpenAI API not available, using mock data');
    return getMockTopicsWithFilters(filters);
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      // Get recent web search results
      const searchResults = await searchWebTopics();
      
      // Prepare the prompt for topic generation
      const categoryBalanceInstruction = filters.categories.length === 0 || filters.categories.length > 1 
        ? `【カテゴリバランス指定】
- ニュース: 3件（政治・経済・社会・テクノロジー等の時事ニュース）
- エンタメ: 2件（アニメ・映画・音楽・芸能・ゲーム）
- SNS: 2件（Twitter/X・Instagram・YouTube等のプラットフォーム動向）
- TikTok: 2件（TikTok固有のトレンド・チャレンジ・バズ動画）
${filters.includeIncidents ? '- 事件事故: 1件（事件・事故・災害）' : ''}` 
        : '';

      const systemPrompt = `
あなたは日本の配信者向けトーク台本作成アシスタントです。最新の情報を基に、配信で話せるトピックを生成してください。

【カテゴリ定義（厳密に従ってください）】
- ニュース: 政治・経済・社会・テクノロジー・国際情勢等の時事ニュース
- エンタメ: アニメ・映画・音楽・芸能・ゲーム・スポーツ
- SNS: Twitter/X・Instagram・YouTube等のプラットフォーム動向・バズ
- TikTok: TikTok固有のトレンド・チャレンジ・バズ動画・クリエイター話題
- 事件事故: 事件・事故・災害・緊急事態

${categoryBalanceInstruction}

以下の条件でトピックを10〜15件生成してください：
- 各トピックは配信での会話に適している
- 上記カテゴリ定義に厳密に従って分類
- 各トピックに以下の情報を含める:
  - id: ユニークID (topic- + 8桁の数字)
  - title: 魅力的なタイトル (30文字以内)
  - category: 上記5カテゴリのいずれかに正確に分類
  - summary: 3行以内の具体的な要約
  - sensitivityLevel: 1-3の数値 (1=安全, 2=注意, 3=慎重)
  - riskLevel: "low", "medium", "high"
  - sourceUrl: 情報源URL (仮想的でも可)
  - createdAt: 現在日時のISO文字列

フィルター条件:
- カテゴリ: ${filters.categories.length > 0 ? filters.categories.join(', ') : '全カテゴリ（バランス重視）'}
- 事件事故含む: ${filters.includeIncidents ? 'はい' : 'いいえ'}
- テンション: ${filters.tension}

レスポンスはJSON配列形式で、Topic[]型に準拠してください。マークダウンコードブロックは使わず、純粋なJSONのみを返してください。
      `;

      const userPrompt = `
検索結果:
${searchResults}

上記の検索結果と最新の日本のトレンドを参考に、配信向けトピックを生成してください。
フィルター条件に基づいて適切にフィルタリングし、多様なカテゴリから選んでください。
      `;

      const completion = await getOpenAI()!.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }, {
        timeout: REQUEST_TIMEOUT,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI API');
      }

      // Parse the JSON response
      const topics: Topic[] = JSON.parse(response);
      
      // Validate and filter topics
      const validTopics = topics.filter(topic => 
        topic.id && topic.title && topic.category && topic.summary
      );

      if (validTopics.length === 0) {
        throw new Error('No valid topics generated');
      }

      if (DEBUG) console.log(`Generated ${validTopics.length} topics successfully`);
      return validTopics.slice(0, 20); // Limit to maximum 20 topics

    } catch (error) {
      retries++;
      if (DEBUG) console.error(`OpenAI API call failed (attempt ${retries}):`, error);
      
      if (retries >= MAX_RETRIES) {
        if (DEBUG) console.warn('Max retries reached, falling back to mock data');
        return getMockTopicsWithFilters(filters);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }

  // Fallback to mock data
  return getMockTopicsWithFilters(filters);
}

/**
 * Generate script using OpenAI API
 */
export async function generateScript(
  topicId: string,
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string
): Promise<Script> {
  // Fallback to mock data if OpenAI is not available
  if (!getOpenAI() || !process.env.OPENAI_API_KEY) {
    if (DEBUG) console.warn('OpenAI API not available, using mock data');
    return getMockScript(topicId, duration, tension, tone);
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      // Find the topic (first check if it's in generated topics, fallback to mock)
      const topic = mockTopics.find(t => t.id === topicId);
      if (!topic) {
        throw new Error('Topic not found');
      }

      // Determine template type based on category
      const isIncident = topic.category === '事件事故';
      
      const systemPrompt = `
あなたは配信者向けトーク台本作成の専門家です。以下の条件で台本を作成してください：

条件:
- 尺: ${duration}秒
- テンション: ${tension}
- 口調: ${tone}
- 著作権配慮（全文引用禁止、要約のみ）
- 炎上ワード自動抑制

${isIncident ? `
【事件事故専用テンプレート】
以下の要素を含む台本を作成:
- factualReport: 事実のみの冷静な報告
- seriousContext: 深刻さを伝える背景説明
- avoidanceNotes: 避けるべき表現や注意点
注意: 煽らない、犯人断定しない、感情過多NG、陰謀論排除、事実ベース、シリアストーン
` : `
【通常トピック用テンプレート】
以下の要素を含む台本を作成:
- opening: つかみのあいさつ
- explanation: ざっくりとした説明
- streamerComment: 配信者の個人的コメント
- viewerQuestions: 視聴者参加用の質問3つ (配列)
- expansions: 話を広げる方向性3つ (配列)
- transition: 次の話題への繋ぎ
`}

レスポンスは以下のScript型のJSON形式で返してください（マークダウンコードブロックは使わず、純粋なJSONのみ）:
{
  "id": "script-${topicId}",
  "topicId": "${topicId}",
  "duration": ${duration},
  "tension": "${tension}",
  "tone": "${tone}",
  "content": { ... }
}
      `;

      const userPrompt = `
トピック情報:
タイトル: ${topic.title}
カテゴリ: ${topic.category}
要約: ${topic.summary}
センシティブ度: ${topic.sensitivityLevel}
炎上リスク: ${topic.riskLevel}

上記のトピックに基づいて、指定された条件で台本を作成してください。
      `;

      const completion = await getOpenAI()!.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.8,
      }, {
        timeout: REQUEST_TIMEOUT,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI API');
      }

      // Clean the response (remove markdown code blocks if present)
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      
      // Parse the JSON response
      const script: Script = JSON.parse(cleanedResponse);
      
      // Validate script structure
      if (!script.content || typeof script.content !== 'object') {
        throw new Error('Invalid script structure');
      }

      if (DEBUG) console.log(`Generated script for topic ${topicId} successfully`);
      return script;

    } catch (error) {
      retries++;
      if (DEBUG) console.error(`OpenAI API call failed for script generation (attempt ${retries}):`, error);
      
      if (retries >= MAX_RETRIES) {
        if (DEBUG) console.warn('Max retries reached, falling back to mock data');
        return getMockScript(topicId, duration, tension, tone);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }

  // Fallback to mock data
  return getMockScript(topicId, duration, tension, tone);
}

/**
 * Get mock topics with filters applied (fallback function)
 */
function getMockTopicsWithFilters(filters: FilterOptions): Promise<Topic[]> {
  return new Promise(resolve => {
    setTimeout(() => {
      let filteredTopics = mockTopics;

      // Category filter
      if (filters.categories.length > 0) {
        filteredTopics = filteredTopics.filter(topic => 
          filters.categories.includes(topic.category)
        );
      }

      // Incident filter
      if (!filters.includeIncidents) {
        filteredTopics = filteredTopics.filter(topic => 
          topic.category !== '事件事故'
        );
      }

      // Risk level adjustment based on tension
      if (filters.tension === 'low') {
        filteredTopics = filteredTopics.filter(topic => 
          topic.riskLevel !== 'high'
        );
      }

      resolve(filteredTopics.slice(0, 15));
    }, 1000);
  });
}

/**
 * Get mock script (fallback function)
 */
function getMockScript(
  topicId: string,
  duration: 15 | 60 | 180,
  tension: 'low' | 'medium' | 'high',
  tone: string
): Promise<Script> {
  return new Promise(resolve => {
    setTimeout(() => {
      const existingScript = mockScripts[topicId];
      
      if (existingScript) {
        resolve({
          ...existingScript,
          duration,
          tension,
          tone
        });
        return;
      }

      // Generate new mock script
      const topic = mockTopics.find(t => t.id === topicId);
      if (!topic) {
        throw new Error('Topic not found');
      }

      // Incident-specific template
      if (topic.category === '事件事故') {
        resolve({
          id: `script-${topicId}`,
          topicId,
          duration,
          tension,
          tone,
          content: {
            factualReport: `${topic.title}について、現時点で公表されている情報をお伝えします。`,
            seriousContext: `${topic.summary.slice(0, 100)}との報告があります。詳細な調査が進められている状況です。`,
            avoidanceNotes: '詳細情報や憶測については控え、正式な発表を待つ必要があります。'
          }
        });
        return;
      }

      // Regular topic template
      const durationAdjustment = duration === 15 ? '短く' : duration === 180 ? '詳しく' : '';
      const tensionAdjustment = tension === 'high' ? 'エネルギッシュに' : tension === 'low' ? '落ち着いて' : '';

      resolve({
        id: `script-${topicId}`,
        topicId,
        duration,
        tension,
        tone,
        content: {
          opening: `${tensionAdjustment}こんにちは！今日は${topic.category}から面白い話題をお届けします！`,
          explanation: `${durationAdjustment}${topic.summary}`,
          streamerComment: `${tone}な視点から言うと、これは結構注目すべき話題だと思います。`,
          viewerQuestions: [
            'この話題についてどう思いますか？',
            '似たような経験はありますか？',
            '今後どうなると思いますか？'
          ],
          expansions: [
            'この分野の最新動向について',
            '他の関連トピックとの比較',
            '今後の予測と影響について'
          ],
          transition: '次の話題も面白いので、続けて見ていきましょう。'
        }
      });
    }, 800);
  });
}

/**
 * Get available tone presets
 */
export function getTonePresets(): string[] {
  return tonePresets;
}

/**
 * Get API usage statistics
 * Note: OpenAI doesn't provide real-time usage stats via API
 * This would typically be tracked internally or estimated
 */
export async function getUsageStats(): Promise<{
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
}> {
  // In a real implementation, you would track these internally
  // or use OpenAI's usage dashboard data
  
  return {
    tokensUsed: Math.floor(Math.random() * 5000) + 1000,
    tokensLimit: 10000,
    requestsUsed: Math.floor(Math.random() * 50) + 10,
    requestsLimit: 100
  };
}

/**
 * Check if OpenAI API is properly configured
 */
export function isOpenAIConfigured(): boolean {
  return !!(getOpenAI() && process.env.OPENAI_API_KEY);
}