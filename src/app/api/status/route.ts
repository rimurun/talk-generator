import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      perplexityEnabled: !!process.env.PERPLEXITY_API_KEY,
      openaiEnabled: !!process.env.OPENAI_API_KEY,
      gnewsEnabled: !!process.env.GNEWS_API_KEY,
      xApiEnabled: !!process.env.X_API_BEARER_TOKEN,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      perplexityEnabled: false,
      openaiEnabled: false,
      gnewsEnabled: false,
      xApiEnabled: false,
      error: 'Status check failed',
      timestamp: new Date().toISOString(),
    });
  }
}
