import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  // Stripe未設定の場合は503を返す
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: '決済機能は現在準備中です' }, { status: 503 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: '決済サービスに接続できません' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { email } = body;

    // Stripe Checkoutセッションを作成
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
        quantity: 1,
      }],
      customer_email: email || undefined,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://talk-generator-beta.vercel.app'}/settings?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://talk-generator-beta.vercel.app'}/pricing?checkout=cancelled`,
      // 日本円のため自動税計算は無効
      automatic_tax: { enabled: false },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Checkout session作成エラー:', message);
    return NextResponse.json({ error: 'チェックアウトセッションの作成に失敗しました' }, { status: 500 });
  }
}
