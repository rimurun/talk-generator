import { NextResponse } from 'next/server';
import { isOpenAIConfigured } from '@/lib/openai';

export async function GET() {
  try {
    const openaiEnabled = isOpenAIConfigured();
    
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