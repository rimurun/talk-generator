import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // OPENAI_API_KEYが設定されているかをインラインで確認
    const openaiEnabled = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      openaiEnabled,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Status check error:', error);
    
    return NextResponse.json({
      openaiEnabled: false,
      error: 'Status check failed',
      timestamp: new Date().toISOString(),
    });
  }
}