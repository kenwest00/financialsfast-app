import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const reportId = session.metadata?.report_id || 'unknown';
      const amount = ((session.amount_total || 0) / 100).toFixed(2);
      console.log(`✅ Payment completed: report=${reportId}, amount=$${amount}`);
      // No server-side state change — client verifies independently via /api/verify-payment
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`⏰ Session expired: report=${session.metadata?.report_id || 'unknown'}`);
      break;
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute;
      console.error(`🚨 DISPUTE ALERT: ${dispute.id} — reason: ${dispute.reason} — amount: $${(dispute.amount / 100).toFixed(2)}`);
      // Future: send alert email to admin via SendGrid/Resend
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const refundAmount = ((charge.amount_refunded || 0) / 100).toFixed(2);
      console.log(`💸 Refund processed: ${charge.id} — $${refundAmount}`);
      break;
    }

    default:
      // Silently ignore unhandled event types
      break;
  }

  return NextResponse.json({ received: true });
}
