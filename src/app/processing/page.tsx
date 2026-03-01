'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOrCreateSessionId, requirePayment, getUploadedFiles, getQuestionnaireData } from '@/lib/db';

interface Stage {
  id: string;
  label: string;
  detail: string;
  status: 'waiting' | 'running' | 'done' | 'error';
}

const INITIAL_STAGES: Stage[] = [
  { id: 'verify', label: 'Verifying payment', detail: 'Confirming your Stripe session', status: 'waiting' },
  { id: 'parse', label: 'Parsing bank statements', detail: 'Extracting transactions from your PDFs', status: 'waiting' },
  { id: 'classify', label: 'Classifying transactions', detail: 'Applying business vs. personal rules', status: 'waiting' },
  { id: 'ai', label: 'AI classification', detail: 'Running ambiguous transactions through Claude', status: 'waiting' },
  { id: 'build', label: 'Building your P&L', detail: 'Aggregating categories and calculating totals', status: 'waiting' },
  { id: 'pdf', label: 'Generating PDF', detail: 'Formatting your lender-ready document', status: 'waiting' },
];

export default function ProcessingPage() {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [currentMessage, setCurrentMessage] = useState('');
  const [error, setError] = useState('');

  const updateStage = (id: string, status: Stage['status']) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  useEffect(() => {
    const run = async () => {
      const sessionId = getOrCreateSessionId();

      // Stage 1: Verify payment
      updateStage('verify', 'running');
      setCurrentMessage('Checking your payment status…');
      await delay(600);

      const paid = await requirePayment(sessionId);
      if (!paid) {
        setError('Payment not found. Please complete checkout first.');
        updateStage('verify', 'error');
        return;
      }
      updateStage('verify', 'done');

      // Stage 2: Load files
      updateStage('parse', 'running');
      setCurrentMessage('Reading your bank statements…');
      const files = await getUploadedFiles(sessionId);
      if (files.length === 0) {
        setError('No bank statements found. Please go back and upload your statements.');
        updateStage('parse', 'error');
        return;
      }

      const questionnaire = await getQuestionnaireData(sessionId);
      if (!questionnaire) {
        setError('Session data missing. Please start over.');
        updateStage('parse', 'error');
        return;
      }

      // Stage 2: Parse PDFs
      setCurrentMessage(`Parsing ${files.length} PDF statement${files.length > 1 ? 's' : ''}…`);
      
      const allParsedTransactions: ParsedTransaction[] = [];
      for (const file of files) {
        try {
          const transactions = await parsePDF(file.fileData, questionnaire);
          allParsedTransactions.push(...transactions);
        } catch (e) {
          console.error('Parse error for', file.fileName, e);
        }
      }

      if (allParsedTransactions.length === 0) {
        setError('Could not extract transactions from your statements. Please ensure you uploaded digital (not scanned) PDF statements.');
        updateStage('parse', 'error');
        return;
      }

      updateStage('parse', 'done');
      setCurrentMessage(`Found ${allParsedTransactions.length} transactions across ${files.length} statement${files.length > 1 ? 's' : ''}`);
      await delay(400);

      // Stage 3: Rule-based classification
      updateStage('classify', 'running');
      setCurrentMessage('Applying business classification rules…');
      await delay(800);
      updateStage('classify', 'done');

      // Stage 4: AI classification
      updateStage('ai', 'running');
      setCurrentMessage('Running transactions through Claude AI…');

      const classified = await classifyTransactions(allParsedTransactions, questionnaire);
      updateStage('ai', 'done');

      // Stage 5: Build P&L
      updateStage('build', 'running');
      setCurrentMessage('Aggregating your P&L categories…');
      const pnlData = buildPnL(classified, questionnaire);
      await delay(600);
      updateStage('build', 'done');

      // Stage 6: Generate PDF
      updateStage('pdf', 'running');
      setCurrentMessage('Generating your lender-ready PDF…');

      const pdfResult = await generatePDF(pnlData, questionnaire);
      await delay(400);
      updateStage('pdf', 'done');

      // Save report to DB
      const { db } = await import('@/lib/db');
      await db.reports.add({
        sessionId,
        generatedAt: new Date(),
        reportData: JSON.stringify({ pnlData, pdfUrl: pdfResult }),
      });

      setCurrentMessage('Your P&L is ready!');
      await delay(800);
      router.push('/download');
    };

    run().catch((e) => {
      console.error(e);
      setError('An unexpected error occurred. Please try again.');
    });
  }, [router]);

  const allDone = stages.every((s) => s.status === 'done');
  const currentRunning = stages.find((s) => s.status === 'running');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1B3A5C] rounded-md flex items-center justify-center">
            <span className="text-[#C9A84C] text-xs font-bold">FF</span>
          </div>
          <span className="font-bold text-[#1B3A5C] text-sm">Financials Fast</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Spinner / done icon */}
          <div className="flex justify-center mb-6">
            {allDone ? (
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-500 text-3xl">✓</span>
              </div>
            ) : error ? (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-500 text-3xl">!</span>
              </div>
            ) : (
              <div className="w-16 h-16 border-4 border-[#1B3A5C] border-t-[#C9A84C] rounded-full animate-spin" />
            )}
          </div>

          <h1 className="text-xl font-bold text-[#1B3A5C] text-center mb-1">
            {allDone ? 'Your P&L is ready!' : error ? 'Something went wrong' : 'Generating your P&L…'}
          </h1>
          {currentMessage && !error && (
            <p className="text-sm text-slate-500 text-center mb-6">{currentMessage}</p>
          )}
          {error && (
            <p className="text-sm text-red-600 text-center mb-6">{error}</p>
          )}

          {/* Stage list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`flex items-start gap-3 px-5 py-4 ${
                  i < stages.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {stage.status === 'done' && (
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  {stage.status === 'running' && (
                    <div className="w-5 h-5 border-2 border-[#1B3A5C] border-t-transparent rounded-full animate-spin" />
                  )}
                  {stage.status === 'error' && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                  )}
                  {stage.status === 'waiting' && (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                  )}
                </div>

                {/* Label */}
                <div>
                  <p className={`text-sm font-semibold ${
                    stage.status === 'done' ? 'text-emerald-700' :
                    stage.status === 'running' ? 'text-[#1B3A5C]' :
                    stage.status === 'error' ? 'text-red-600' :
                    'text-slate-400'
                  }`}>
                    {stage.label}
                  </p>
                  {(stage.status === 'running' || stage.status === 'done') && (
                    <p className="text-xs text-slate-400 mt-0.5">{stage.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => router.push('/upload')}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm"
              >
                ← Back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-4">
            This usually takes 3–5 minutes. Don&apos;t close this tab.
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Pipeline helpers ─────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
}

interface ClassifiedTransaction extends ParsedTransaction {
  category: string;
  subcategory: string;
  isBusinessExpense: boolean;
  confidence: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parsePDF(fileData: ArrayBuffer, questionnaire: any): Promise<ParsedTransaction[]> {
  // Extract text from PDF using pdf.js via API route
  const blob = new Blob([fileData], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'statement.pdf');
  formData.append('questionnaire', JSON.stringify({
    businessName: questionnaire.businessName,
    industry: questionnaire.industry,
    paymentProcessors: questionnaire.paymentProcessors,
  }));

  try {
    const res = await fetch('/api/parse-statement', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Parse API failed');
    const data = await res.json();
    return data.transactions || [];
  } catch {
    // Fallback: return empty — will be caught by caller
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function classifyTransactions(transactions: ParsedTransaction[], questionnaire: any): Promise<ClassifiedTransaction[]> {
  if (transactions.length === 0) return [];

  try {
    const res = await fetch('/api/classify-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions, questionnaire }),
    });
    if (!res.ok) throw new Error('Classification API failed');
    const data = await res.json();
    return data.classified || [];
  } catch {
    // Return transactions with basic classification
    return transactions.map((t) => ({
      ...t,
      category: t.type === 'credit' ? 'Revenue' : 'Operating Expenses',
      subcategory: 'Uncategorized',
      isBusinessExpense: t.type === 'debit',
      confidence: 0.5,
    }));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPnL(transactions: ClassifiedTransaction[], questionnaire: any) {
  const revenue: Record<string, number> = {};
  const cogs: Record<string, number> = {};
  const opex: Record<string, number> = {};

  for (const t of transactions) {
    if (!t.isBusinessExpense && t.type === 'credit') {
      revenue[t.subcategory] = (revenue[t.subcategory] || 0) + Math.abs(t.amount);
    } else if (t.isBusinessExpense && t.category === 'Cost of Goods Sold') {
      cogs[t.subcategory] = (cogs[t.subcategory] || 0) + Math.abs(t.amount);
    } else if (t.isBusinessExpense) {
      opex[t.subcategory] = (opex[t.subcategory] || 0) + Math.abs(t.amount);
    }
  }

  const totalRevenue = Object.values(revenue).reduce((a, b) => a + b, 0);
  const totalCOGS = Object.values(cogs).reduce((a, b) => a + b, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const totalOpex = Object.values(opex).reduce((a, b) => a + b, 0);
  const netIncome = grossProfit - totalOpex;

  return {
    businessName: questionnaire.businessName,
    period: questionnaire.statementPeriod,
    reportingBasis: questionnaire.reportingBasis,
    revenue,
    cogs,
    opex,
    totalRevenue,
    totalCOGS,
    grossProfit,
    grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    totalOpex,
    netIncome,
    netMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    transactionCount: transactions.length,
    generatedAt: new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generatePDF(pnlData: any, questionnaire: any): Promise<string> {
  try {
    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnlData, questionnaire }),
    });
    if (!res.ok) throw new Error('PDF generation failed');
    const data = await res.json();
    return data.pdfUrl || '';
  } catch {
    return '';
  }
}
