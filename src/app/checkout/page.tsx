'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { getSessionSummary } from '@/lib/db';

interface SessionSummary {
  questionnaire?: {
    businessName: string;
    startDate: string;
    endDate: string;
    email?: string;
  };
  transactionCount: number;
  fileCount: number;
}

function CheckoutContent() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const cancelled = params.get('cancelled') === 'true';

  useEffect(() => {
    async function loadSummary() {
      const data = await getSessionSummary();
      setSummary({
        questionnaire: data.questionnaire ? {
          businessName: data.questionnaire.businessName,
          startDate: data.questionnaire.startDate,
          endDate: data.questionnaire.endDate,
          email: data.questionnaire.email,
        } : undefined,
        transactionCount: data.transactionCount,
        fileCount: data.fileCount,
      });
    }
    loadSummary();
  }, []);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: summary?.questionnaire?.email || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment session');
      }

      // Store reportId in localStorage as a lightweight bridge across the Stripe redirect
      // (Dexie is the source of truth, but localStorage survives the redirect more reliably)
      localStorage.setItem('ff_pending_report_id', data.reportId);

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            Your P&L is ready to generate
          </h1>
          <p className="text-gray-400">
            Review your details below, then proceed to payment.
          </p>
        </div>

        {/* Order Summary Card */}
        <div className="bg-[#111d33] border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Report Summary
          </h2>

          {summary?.questionnaire ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Business</span>
                <span className="font-medium">{summary.questionnaire.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Period</span>
                <span className="font-medium">
                  {summary.questionnaire.startDate} — {summary.questionnaire.endDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transactions found</span>
                <span className="font-medium">{summary.transactionCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bank statements</span>
                <span className="font-medium">{summary.fileCount} file(s)</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">
              Loading your session data...
            </div>
          )}
        </div>

        {/* Price Block */}
        <div className="text-center mb-6">
          <div className="inline-flex items-baseline gap-1">
            <span className="text-5xl font-bold" style={{ color: '#c9a84c' }}>$125</span>
          </div>
          <p className="text-gray-400 mt-1">One-time payment · No subscription · No hidden fees</p>
        </div>

        {/* Trust Signals */}
        <div className="bg-[#111d33] border border-gray-700 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">🔒</span>
            <div>
              <p className="font-medium text-sm">Your data never leaves your browser</p>
              <p className="text-xs text-gray-400">Zero server-side retention. Bank statements stay on your device.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">✓</span>
            <div>
              <p className="font-medium text-sm">Format-rejection refund guarantee</p>
              <p className="text-xs text-gray-400">If your lender rejects the format, we refund 100%.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">⚡</span>
            <div>
              <p className="font-medium text-sm">Lender-ready PDF in under 5 minutes</p>
              <p className="text-xs text-gray-400">Review flagged transactions, then download instantly.</p>
            </div>
          </div>
        </div>

        {/* Error / Cancelled States */}
        {cancelled && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4 text-sm">
            <p className="font-medium text-yellow-300">Payment was cancelled</p>
            <p className="text-yellow-400/80 mt-1">
              Your data is still saved — pick up right where you left off.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4 text-sm">
            <p className="font-medium text-red-300">Something went wrong</p>
            <p className="text-red-400/80 mt-1">{error}</p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleCheckout}
          disabled={loading || !summary?.questionnaire}
          className="w-full py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                     hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: loading ? '#555' : 'linear-gradient(135deg, #c9a84c, #b8942e)',
            color: '#0a1628',
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Connecting to payment...
            </span>
          ) : (
            'Generate My P&L — $125'
          )}
        </button>

        {/* Payment Methods */}
        <div className="text-center mt-4 space-y-1">
          <p className="text-xs text-gray-500">
            Secure payment via Stripe · Apple Pay · Google Pay
          </p>
          <p className="text-xs text-gray-600">
            You&apos;ll be redirected to Stripe&apos;s secure checkout page
          </p>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
