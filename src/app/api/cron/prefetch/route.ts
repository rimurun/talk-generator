import { NextResponse } from 'next/server';
import { generateTopicsWithWebSearch } from '@/lib/openai-responses';

export const maxDuration = 60;

// Vercel Cronから呼ばれる事前生成エンドポイント
export async function GET(request: Request) {
  // CRON_SECRETで認証（不正アクセス防止）
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 全カテゴリ（事件事故除く）で事前生成。キャッシュに保存される
    const defaultFilters = {
      categories: [],
      includeIncidents: false,
      timePeriod: 'today' as const,
      duration: 60 as const,
      tension: 'medium' as const,
      tone: 'フレンドリー',
    };

    // 各カテゴリ個別に生成（キャッシュに個別保存される）
    const categories = ['ニュース', 'エンタメ', 'SNS', 'TikTok', '海外おもしろ'];
    const results = await Promise.allSettled(
      categories.map(cat =>
        generateTopicsWithWebSearch({ ...defaultFilters, categories: [cat] })
      )
    );

    const summary = results.map((r, i) => ({
      category: categories[i],
      status: r.status,
      count: r.status === 'fulfilled' ? r.value.topics.length : 0,
    }));

    return NextResponse.json({
      success: true,
      prefetched: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
