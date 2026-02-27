import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const stripe = getStripe();

    // Generate a unique report ID for tracking through the pipeline
    const reportId = crypto.randomUUID();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: {
        report_id: reportId,
        report_type: 'pnl',
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/processing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout?cancelled=true`,
      customer_creation: 'if_required',
      payment_intent_data: {
        description: 'FinancialsFast P&L Statement',
        metadata: {
          report_id: reportId,
        },
      },
      customer_email: body.email || undefined,
      automatic_tax: { enabled: false },
      // Expire after 30 minutes to prevent stale sessions
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return NextResponse.json({
      url: session.url,
      reportId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe session creation failed:', message);
    return NextResponse.json(
      { error: 'Payment session creation failed. Please try again.' },
      { status: 500 }
    );
  }
}
