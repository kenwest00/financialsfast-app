import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { type ProductType } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Map productType → Stripe Price ID env var
const PRICE_IDS: Record<ProductType, string> = {
  financials:    process.env.STRIPE_PRICE_FINANCIALS!,
  analysis:      process.env.STRIPE_PRICE_ANALYSIS!,
  underwriting:  process.env.STRIPE_PRICE_UNDERWRITING!,
};

const PRODUCT_LABELS: Record<ProductType, string> = {
  financials:    'Financial Statements (P&L + Balance Sheet)',
  analysis:      'Preliminary Loan Analysis',
  underwriting:  'Underwriting Summary — Full Application Package',
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

    // Default to financials
    const type: ProductType = productType && PRICE_IDS[productType]
      ? productType
      : 'financials';

    const priceId = PRICE_IDS[type];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for product: ${type}` },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.financialsfast.com';

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
