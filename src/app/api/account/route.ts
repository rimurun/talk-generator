import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    // Authorization ヘッダーからトークンを取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'データベースが設定されていません' }, { status: 503 });
    }

    // トークンでユーザーを検証
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 });
    }

    const userId = user.id;

    // 関連データを削除（依存テーブルから先に削除）
    // service_role key が設定されている場合は RLS をバイパスして削除
    await supabase.from('script_ratings').delete().eq('user_id', userId);
    await supabase.from('generation_history').delete().eq('user_id', userId);
    await supabase.from('favorites').delete().eq('user_id', userId);
    await supabase.from('users').delete().eq('id', userId);

    // Supabase Auth からユーザーを削除（service_role key が必要）
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      // データは削除済みなので、Auth 削除の失敗は警告に留める
      console.error('Auth ユーザー削除エラー:', deleteError);
    }

    return NextResponse.json({ success: true, message: 'アカウントを削除しました' });
  } catch (error: any) {
    console.error('アカウント削除エラー:', error);
    return NextResponse.json({ error: 'アカウント削除中にエラーが発生しました' }, { status: 500 });
  }
}
