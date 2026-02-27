'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import { storePaymentReceipt } from '@/lib/db';

type PaymentStatus = 'verifying' | 'verified' | 'failed';

function ProcessingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string>('');
  const hasVerified = useRef(false);

  const sessionId = params.get('session_id');

  useEffect(() => {
    // Guard: no session_id means they navigated here directly
    if (!sessionId) {
      router.replace('/checkout');
      return;
    }

    // Prevent double-verification on React strict mode re-render
    if (hasVerified.current) return;
    hasVerified.current = true;

    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function verifyPayment() {
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('failed');
        setError(data.error || 'Payment verification failed.');
        return;
      }

      if (data.paid) {
        // Store payment receipt in Dexie.js (client-side source of truth)
        await storePaymentReceipt({
          sessionId: sessionId!,
          reportId: data.reportId,
          amountPaid: data.amountPaid,
          paymentIntent: data.paymentIntent,
          paidAt: new Date().toISOString(),
        });

        // Clean up the localStorage bridge
        localStorage.removeItem('ff_pending_report_id');

        setStatus('verified');

        // Start the classification pipeline
        await runClassificationPipeline(data.reportId);
      } else {
        setStatus('failed');
        setError(
          data.status === 'unpaid'
            ? 'Payment was not completed. Please try again.'
            : `Payment status: ${data.status}. Please contact support.`
        );
      }
    } catch {
      setStatus('failed');
      setError('Could not verify payment. Please check your connection and try again.');
    }
  }

  async function runClassificationPipeline(reportId: string) {
    // This is where the 4-layer classification pipeline fires.
    // Each stage updates the UI with progress.
    // See pnl_prompt_engineering.md for full pipeline spec.

    const stages = [
      'Extracting transactions from bank statements...',
      'Applying known-entity rules (Layer 1)...',
      'Running pattern matching (Layer 2)...',
      'Classifying with AI (Layer 3)...',
      'Verifying high-value transactions (Layer 4)...',
      'Preparing review screen...',
    ];

    for (let i = 0; i < stages.length; i++) {
      setPipelineStage(stages[i]);
      // TODO: Replace with actual pipeline execution
      // Each stage will call the relevant classification function
      // and store results in Dexie.js classifiedTransactions table
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Pipeline complete — route to review screen
    router.push(`/review?report=${reportId}`);
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">

        {/* Verifying Payment */}
        {status === 'verifying' && (
          <div className="space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-gray-600 border-t-[#c9a84c] animate-spin" />
            <div>
              <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                Confirming your payment...
              </h1>
              <p className="text-gray-400">This takes just a moment.</p>
            </div>
          </div>
        )}

        {/* Payment Verified — Pipeline Running */}
        {status === 'verified' && (
          <div className="space-y-6">
            {/* Success checkmark */}
            <div className="mx-auto w-16 h-16 rounded-full bg-green-900/30 border-2 border-green-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                Payment confirmed!
              </h1>
              <p className="text-gray-400">Now classifying your transactions...</p>
            </div>

            {/* Pipeline Progress */}
            <div className="bg-[#111d33] border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-gray-500 border-t-[#c9a84c] animate-spin flex-shrink-0" />
                <p className="text-sm text-gray-300 text-left">{pipelineStage}</p>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    background: 'linear-gradient(135deg, #c9a84c, #b8942e)',
                    width: '60%', // TODO: derive from actual pipeline progress
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              All processing happens in your browser. Your data never touches our servers.
            </p>
          </div>
        )}

        {/* Payment Failed */}
        {status === 'failed' && (
          <div className="space-y-6">
            {/* Error icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-red-900/30 border-2 border-red-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                Payment could not be verified
              </h1>
              <p className="text-gray-400">{error}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/checkout')}
                className="w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 
                           hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #c9a84c, #b8942e)',
                  color: '#0a1628',
                }}
              >
                Try Again
              </button>

              <p className="text-xs text-gray-500">
                If you were charged, email{' '}
                <a href="mailto:support@financialsfast.com" className="text-[#c9a84c] underline">
                  support@financialsfast.com
                </a>{' '}
                with your receipt and we&apos;ll resolve it immediately.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center">
        <div className="mx-auto w-16 h-16 rounded-full border-4 border-gray-600 border-t-[#c9a84c] animate-spin" />
      </main>
    }>
      <ProcessingContent />
    </Suspense>
  );
}
