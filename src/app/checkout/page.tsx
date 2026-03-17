'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  getOrCreateSessionId,
  getQuestionnaireData,
  getUploadedFiles,
  markPaymentComplete,
  getProductType,
  PRODUCT_CONFIG,
  type ProductType,
} from '@/lib/db';

const PRODUCT_DETAILS: Record<ProductType, {
  icon: string;
  deliverables: string[];
  periodLabel?: string;
}> = {
  pnl: {
    icon: '📊',
    deliverables: [
      'Profit & Loss statement (PDF)',
      'Transaction detail appendix',
      'Lender methodology notes',
    ],
  },
  'balance-sheet': {
    icon: '🏦',
    deliverables: [
      'Balance sheet (PDF)',
      'Asset & liability schedule',
      'Equity reconciliation notes',
    ],
  },
  bundle: {
    icon: '📁',
    deliverables: [
      'Profit & Loss statement (PDF)',
      'Balance sheet (PDF)',
      'Transaction detail appendix',
      'Reconciliation notes linking both statements',
      'Delivered as a single ZIP file',
    ],
  },
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState('');
  const [businessName, setBusinessName] = useState('Your Business');
  const [period, setPeriod] = useState('3-month');
  const [fileCount, setFileCount] = useState(0);
  const [productType, setProductTypeState] = useState<ProductType>('pnl');
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    const type = getProductType();
    setProductTypeState(type);

    // Check for returning from Stripe
    const stripeSession = searchParams.get('session_id');
    if (stripeSession) {
      handleStripeReturn(sid, stripeSession);
      return;
    }

    // Load session data
    Promise.all([
      getQuestionnaireData(sid),
      getUploadedFiles(sid),
    ]).then(([qData, files]) => {
      // Balance-sheet-only doesn't require questionnaire data
      if (!qData && type !== 'balance-sheet') {
        router.push('/questionnaire');
        return;
      }
      // P&L and bundle require uploaded files
      if (files.length === 0 && type !== 'balance-sheet') {
        router.push('/upload');
        return;
      }

      if (qData) {
        setBusinessName(qData.businessName as string || 'Your Business');
        const periodLabel: Record<string, string> = {
          '3': '3-Month', '6': '6-Month', '12': '12-Month',
          'ytd': 'Year-to-Date', 'custom': 'Custom Period',
        };
        setPeriod(periodLabel[qData.statementPeriod as string || '3'] || '3-Month');
      }

      setFileCount(files.length);
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]);

  const handleStripeReturn = async (sid: string, stripeSessionId: string) => {
    try {
      const res = await fetch(`/api/verify-payment?session_id=${stripeSessionId}`);
      const data = await res.json();
      if (data.paid) {
        await markPaymentComplete(stripeSessionId, data);
        router.push('/processing');
      } else {
        setError('Payment could not be verified. Please try again.');
        setIsLoading(false);
      }
    } catch {
      setError('There was an error verifying your payment. Please contact support.');
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    setIsRedirecting(true);
    setError('');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, productType, businessName }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Unable to start checkout. Please try again.');
        setIsRedirecting(false);
      }
    } catch {
      setError('Connection error. Please check your internet and try again.');
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#1B3A5C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Loading your session…</p>
        </div>
      </div>
    );
  }

  const config = PRODUCT_CONFIG[productType];
  const details = PRODUCT_DETAILS[productType];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1B3A5C] rounded-md flex items-center justify-center">
            <span className="text-[#C9A84C] text-xs font-bold">FF</span>
          </div>
          <span className="font-bold text-[#1B3A5C] text-sm">Financials Fast</span>
        </a>
        <div className="flex items-center gap-1.5">
          {['Questionnaire', productType !== 'balance-sheet' ? 'Statements' : null]
            .filter(Boolean)
            .map((step) => (
            <div key={step} className="flex items-center gap-1">
              <div className="w-5 h-5 bg-[#C9A84C] rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-xs text-slate-500 hidden sm:inline">{step}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Progress */}
      <div className="w-full h-1 bg-slate-200">
        <div className="h-1 bg-[#C9A84C] transition-all duration-500" style={{ width: '85%' }} />
      </div>

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-[#1B3A5C]">Almost there</h1>
            <p className="text-sm text-slate-500 mt-1">
              Review your order and pay securely to generate your {config.label}
            </p>
          </div>

          {/* Order summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            {/* Product header */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{details.icon}</span>
                  <div>
                    <p className="font-bold text-slate-800">{config.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {businessName}
                      {productType !== 'balance-sheet' && ` · ${period} P&L`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800 text-lg">{config.priceDisplay}</p>
                  {'originalPrice' in config && config.originalPrice && (
                    <p className="text-xs text-slate-400 line-through">${config.originalPrice}</p>
                  )}
                  <p className="text-xs text-slate-400">one-time</p>
                </div>
              </div>
            </div>

            {/* What you'll receive */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What you'll receive</p>
              <div className="space-y-1.5">
                {details.deliverables.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500 text-xs">✓</span>
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Session details */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
              <div className="space-y-2">
                {productType !== 'balance-sheet' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Bank statements uploaded</span>
                      <span className="font-medium text-slate-700">{fileCount} PDF{fileCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Report period</span>
                      <span className="font-medium text-slate-700">{period}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Output format</span>
                  <span className="font-medium text-slate-700">
                    {config.deliverable === 'zip' ? 'ZIP (2 PDFs)' : 'Lender-grade PDF'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Est. completion</span>
                  <span className="font-medium text-slate-700">{config.timeEstimate}</span>
                </div>
              </div>
            </div>

            {/* Savings for bundle */}
            {'savings' in config && config.savings && (
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex justify-between text-sm">
                <span className="text-emerald-700 font-medium">Bundle discount</span>
                <span className="text-emerald-700 font-bold">−${config.savings}</span>
              </div>
            )}

            {/* Total */}
            <div className="px-5 py-4 flex justify-between items-center">
              <span className="font-bold text-slate-800">Total</span>
              <span className="font-bold text-[#1B3A5C] text-xl">{config.priceDisplay}</span>
            </div>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: '🔒', label: 'Zero data retention' },
              { icon: '⚡', label: `Ready in ${config.timeEstimate}` },
              { icon: '↩', label: 'Money-back guarantee' },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                <div className="text-xl mb-1">{icon}</div>
                <p className="text-xs text-slate-600 font-medium leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* CPA comparison */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-amber-800">
              <strong>A CPA charges $400–$2,000</strong> and takes 1–2 weeks for the same documents.
              Yours will be ready in {config.timeEstimate}.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handlePay}
            disabled={isRedirecting}
            className="w-full py-4 rounded-xl bg-[#C9A84C] text-white font-bold text-base hover:bg-[#b8973f] transition-all disabled:opacity-60 shadow-md"
          >
            {isRedirecting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Redirecting to Stripe…
              </span>
            ) : (
              `Pay ${config.priceDisplay} — Generate My ${productType === 'bundle' ? 'Package' : config.label} →`
            )}
          </button>

          <p className="text-center text-xs text-slate-400 mt-3">
            Secure payment by Stripe · SSL encrypted · No card data touches our servers
          </p>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => router.push(productType === 'balance-sheet' ? '/questionnaire/balance-sheet' : '/upload')}
              className="flex-1 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl"
            >
              ← Back
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1B3A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
