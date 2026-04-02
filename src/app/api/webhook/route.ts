import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

// Webhookのボディはrawテキストで受け取る必要がある（署名検証のため）
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  // 署名またはWebhookシークレットが未設定の場合は400
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // イベントタイプに応じた処理
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[Stripe] チェックアウト完了:', session.customer_email);
        // TODO: Supabase users テーブルの plan フィールドを 'pro' に更新
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('[Stripe] サブスクリプション解約:', subscription.id);
        // TODO: Supabase users テーブルの plan フィールドを 'free' に更新
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('[Stripe] 支払い失敗:', invoice.customer);
        break;
      }
      default:
        console.log('[Stripe] 未処理イベント:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Webhook処理エラー:', message);
    return NextResponse.json({ error: 'Webhook処理に失敗しました' }, { status: 400 });
  }
}
