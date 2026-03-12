import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// テストアカウント作成用の一時エンドポイント（デプロイ後に削除予定）
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase未設定' }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const accounts = [
    { email: 'talkgen.test1@gmail.com', password: 'TalkGen2026!' },
    { email: 'talkgen.test2@gmail.com', password: 'TalkGen2026!' },
  ];

  const results = [];
  for (const acct of accounts) {
    const { data, error } = await sb.auth.signUp(acct);
    results.push({
      email: acct.email,
      password: acct.password,
      userId: data?.user?.id || null,
      error: error?.message || null,
    });
  }

  return NextResponse.json({ accounts: results });
}
