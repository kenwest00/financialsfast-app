import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    const stripe = getStripe();

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Prevent obviously malformed session IDs from hitting Stripe
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      return NextResponse.json({
        paid: true,
        reportId: session.metadata?.report_id,
        receiptEmail: session.customer_details?.email,
        amountPaid: session.amount_total,
        paymentIntent: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      });
    }

    return NextResponse.json({
      paid: false,
      status: session.payment_status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Payment verification failed:', message);

    // Distinguish between Stripe errors and our errors
    if (message.includes('No such checkout.session')) {
      return NextResponse.json(
        { error: 'Payment session not found. It may have expired.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Payment verification failed. Please contact support.' },
      { status: 500 }
    );
  }
}
