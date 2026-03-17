import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { type ProductType } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Map productType → Stripe Price ID env var
const PRICE_IDS: Record<ProductType, string> = {
  pnl:             process.env.STRIPE_PRICE_PNL!,
  'balance-sheet': process.env.STRIPE_PRICE_BS!,
  cashflow:        process.env.STRIPE_PRICE_CASHFLOW!,
  bundle:          process.env.STRIPE_PRICE_BUNDLE!,
};

const PRODUCT_LABELS: Record<ProductType, string> = {
  pnl:             'P&L Statement',
  'balance-sheet': 'Balance Sheet',
  cashflow:        'Cash Flow Projection',
  bundle:          'Complete Financial Package (P&L + Balance Sheet + Cash Flow)',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, productType, businessName } = body as {
      sessionId: string;
      productType?: ProductType;
      businessName?: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Default to pnl for backward compatibility
    const type: ProductType = productType && PRICE_IDS[productType]
      ? productType
      : 'pnl';

    const priceId = PRICE_IDS[type];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for product: ${type}` },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://financialsfast.com';

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${baseUrl}/checkout?session_id={CHECKOUT_SESSION_ID}&ff_session=${sessionId}&product=${type}`,
      cancel_url: `${baseUrl}/checkout`,
      client_reference_id: sessionId,
      metadata: {
        ff_session_id: sessionId,
        product_type: type,
        business_name: businessName || '',
      },
      payment_intent_data: {
        description: `Financials Fast — ${PRODUCT_LABELS[type]}${businessName ? ` for ${businessName}` : ''}`,
        metadata: {
          ff_session_id: sessionId,
          product_type: type,
        },
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
