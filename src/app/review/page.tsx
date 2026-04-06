'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getOrCreateSessionId, getQuestionnaireData } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassifiedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  subcategory: string;
  isBusinessExpense: boolean;
  confidence: number;
}

// ─── Category options ────────────────────────────────────────────────────────

const SUBCATEGORY_OPTIONS = [
  { group: 'Revenue', items: ['Sales Revenue', 'Service Revenue', 'Other Income'] },
  { group: 'Cost of Goods Sold', items: ['Cost of Goods', 'Direct Labor', 'Shipping & Fulfillment'] },
  { group: 'Operating Expenses', items: ['Software & Subscriptions', 'Marketing & Advertising', 'Rent & Facilities', 'Professional Services', 'Insurance', 'Vehicle Expense', 'Travel', 'Meals & Entertainment', 'Bank Fees', 'Utilities', 'Office Supplies', 'Payroll & Wages', 'Debt Service', 'Other Operating'] },
  { group: 'Non-P&L', items: ["Owner's Draw", 'Personal', 'Transfer', 'Tax Payment'] },
];

function categoryFromSubcategory(sub: string): string {
  for (const group of SUBCATEGORY_OPTIONS) {
    if (group.items.includes(sub)) return group.group;
  }
  return 'Operating Expenses';
}

function isBusinessFromCategory(cat: string): boolean {
  return cat !== 'Non-P&L';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return n < 0 ? `($${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function confidenceLabel(c: number): { text: string; color: string } {
  if (c >= 0.85) return { text: 'High', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  if (c >= 0.65) return { text: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return { text: 'Low', color: 'text-red-600 bg-red-50 border-red-200' };
}

const CONFIDENCE_THRESHOLD = 0.85;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<ClassifiedTransaction[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStage, setGenStage] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questionnaire, setQuestionnaire] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    // Load classified transactions from sessionStorage
    try {
      const stored = sessionStorage.getItem('ff_classified');
      if (!stored) {
        router.push('/processing');
        return;
      }
      setTransactions(JSON.parse(stored));
    } catch {
      router.push('/processing');
      return;
    }

    // Load questionnaire
    const sid = getOrCreateSessionId();
    getQuestionnaireData(sid).then((data) => {
      if (data) setQuestionnaire(data);
    });
  }, [router]);

  // Separate flagged vs confirmed
  const flagged = useMemo(
    () => transactions.filter((t) => t.confidence < CONFIDENCE_THRESHOLD),
    [transactions]
  );
  const confirmed = useMemo(
    () => transactions.filter((t) => t.confidence >= CONFIDENCE_THRESHOLD),
    [transactions]
  );

  // Summary stats
  const stats = useMemo(() => {
    const rev = transactions.filter((t) => t.type === 'credit' && t.category !== 'Non-P&L').reduce((s, t) => s + Math.abs(t.amount), 0);
    const exp = transactions.filter((t) => t.isBusinessExpense && t.category !== 'Non-P&L').reduce((s, t) => s + Math.abs(t.amount), 0);
    const excluded = transactions.filter((t) => t.category === 'Non-P&L').length;
    return { revenue: rev, expenses: exp, net: rev - exp, excluded, total: transactions.length };
  }, [transactions]);

  // Update a transaction's subcategory
  const updateTransaction = (index: number, newSubcategory: string) => {
    setTransactions((prev) => {
      const updated = [...prev];
      // Find the actual index in the full array
      const flaggedItem = flagged[index];
      const fullIndex = prev.indexOf(flaggedItem);
      if (fullIndex === -1) return prev;

      const newCategory = categoryFromSubcategory(newSubcategory);
      updated[fullIndex] = {
        ...updated[fullIndex],
        subcategory: newSubcategory,
        category: newCategory,
        isBusinessExpense: isBusinessFromCategory(newCategory) && updated[fullIndex].type === 'debit',
        confidence: 1.0, // User confirmed
      };
      return updated;
    });
  };

  // Confirm all flagged items as-is
  const confirmAll = () => {
    setTransactions((prev) =>
      prev.map((t) => t.confidence < CONFIDENCE_THRESHOLD ? { ...t, confidence: 1.0 } : t)
    );
  };

  // Generate P&L and PDF
  const handleGenerate = async () => {
    if (!questionnaire) return;
    setIsGenerating(true);

    // Build P&L
    setGenStage('Building your P&L…');
    const pnlData = buildPnL(transactions, questionnaire);
    await delay(600);

    // Generate PDF
    setGenStage('Generating lender-ready PDF…');
    const pdfResult = await generatePDF(pnlData, questionnaire);
    await delay(400);

    // Save report
    setGenStage('Saving your report…');
    const { db } = await import('@/lib/db');
    await db.reports.add({
      reportData: JSON.stringify({ pnlData, pdfUrl: pdfResult }),
    });

    // Clean up sessionStorage
    sessionStorage.removeItem('ff_classified');
    sessionStorage.removeItem('ff_total_parsed');

    await delay(300);
    router.push('/download');
  };

  const allReviewed = flagged.length === 0;
  const displayItems = showAll ? transactions : flagged;

  return (
    <div className="min-h-screen bg-[#FAFBFD]" style={{ fontFamily: "'Satoshi', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
            <span className="text-[#C9A84C] text-xs font-bold">FF</span>
          </div>
          <span className="font-bold text-[#1B3A5C] text-[15px] tracking-[-0.02em]">
            Financials<span className="text-[#C9A84C]">Fast</span>
          </span>
        </a>
      </nav>

      {/* Generating overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-[#1B3A5C]/20 border-t-[#C9A84C] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold text-[#1B3A5C]">{genStage}</p>
            <p className="text-sm text-slate-400 mt-1">This will just take a moment</p>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Review Your Transactions</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            We classified {stats.total} transactions.
            {flagged.length > 0
              ? ` ${flagged.length} item${flagged.length !== 1 ? 's' : ''} need${flagged.length === 1 ? 's' : ''} your input — the rest were classified with high confidence.`
              : ' All transactions were classified with high confidence. Review and confirm below.'
            }
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Revenue</p>
            <p className="text-lg font-bold text-[#1B3A5C] mt-1">{formatCurrency(stats.revenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Expenses</p>
            <p className="text-lg font-bold text-[#1B3A5C] mt-1">{formatCurrency(stats.expenses)}</p>
          </div>
          <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.net >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Net Income</p>
            <p className={`text-lg font-bold mt-1 ${stats.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(stats.net)}</p>
          </div>
        </div>

        {/* Toggle + actions bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !showAll ? 'bg-[#1B3A5C] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Flagged ({flagged.length})
            </button>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showAll ? 'bg-[#1B3A5C] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              All ({transactions.length})
            </button>
          </div>
          {flagged.length > 0 && (
            <button
              type="button"
              onClick={confirmAll}
              className="text-xs text-[#C9A84C] font-semibold hover:underline underline-offset-2"
            >
              Accept all AI suggestions
            </button>
          )}
        </div>

        {/* Transaction list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          {/* Table header */}
          <div className="grid grid-cols-[100px_1fr_100px_180px_60px] gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Date</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span>Category</span>
            <span className="text-center">Conf.</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
            {displayItems.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-slate-400">
                {showAll ? 'No transactions found' : 'No flagged items — all transactions were classified with high confidence'}
              </div>
            )}
            {displayItems.map((t, displayIdx) => {
              const conf = confidenceLabel(t.confidence);
              const isFlagged = t.confidence < CONFIDENCE_THRESHOLD;
              // Find the index in the flagged array for editing
              const flaggedIdx = isFlagged ? flagged.indexOf(t) : -1;

              return (
                <div
                  key={`${t.date}-${t.description}-${t.amount}-${displayIdx}`}
                  className={`grid grid-cols-[100px_1fr_100px_180px_60px] gap-2 px-5 py-3 items-center transition-colors ${
                    isFlagged ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'
                  }`}
                >
                  {/* Date */}
                  <span className="text-xs text-slate-500 font-mono">
                    {t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>

                  {/* Description */}
                  <span className="text-sm text-slate-700 truncate" title={t.description}>
                    {t.description}
                  </span>

                  {/* Amount */}
                  <span className={`text-sm font-medium text-right font-mono ${t.type === 'credit' ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>

                  {/* Category dropdown */}
                  {isFlagged && flaggedIdx >= 0 ? (
                    <select
                      value={t.subcategory}
                      onChange={(e) => updateTransaction(flaggedIdx, e.target.value)}
                      className="text-xs bg-white border-2 border-amber-300 rounded-lg px-2 py-1.5 text-slate-700 font-medium focus:border-[#1B3A5C] focus:ring-1 focus:ring-[#1B3A5C]/20 outline-none transition-all cursor-pointer"
                    >
                      {SUBCATEGORY_OPTIONS.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.items.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500 truncate" title={`${t.category} → ${t.subcategory}`}>
                      {t.subcategory}
                    </span>
                  )}

                  {/* Confidence */}
                  <span className="flex justify-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${conf.color}`}>
                      {conf.text}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Excluded summary */}
        {stats.excluded > 0 && (
          <p className="text-xs text-slate-400 mb-6">
            {stats.excluded} transaction{stats.excluded !== 1 ? 's' : ''} marked as personal, transfers, or owner draws — excluded from P&L
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/upload')}
            className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-slate-500 font-semibold text-sm hover:border-slate-300 hover:text-slate-700 transition-all"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`flex-[2] py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              allReviewed
                ? 'bg-[#1B3A5C] text-white hover:bg-[#152e4a] active:scale-[0.99] shadow-sm'
                : 'bg-[#C9A84C] text-white hover:bg-[#b8953e] active:scale-[0.99] shadow-sm'
            }`}
          >
            {allReviewed
              ? `Generate My Financial Statements →`
              : `Confirm ${flagged.length} Flagged Item${flagged.length !== 1 ? 's' : ''} & Generate →`
            }
          </button>
        </div>

        {/* Note */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Updating a category will reclassify that transaction on your P&L. High-confidence items are already included correctly.
        </p>
      </main>
    </div>
  );
}

// ─── Pipeline helpers (moved from processing page) ──────────────────────────

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPnL(transactions: ClassifiedTransaction[], questionnaire: any) {
  const revenue: Record<string, number> = {};
  const cogs: Record<string, number> = {};
  const opex: Record<string, number> = {};

  for (const t of transactions) {
    if (!t.isBusinessExpense && t.type === 'credit' && t.category !== 'Non-P&L') {
      revenue[t.subcategory] = (revenue[t.subcategory] || 0) + Math.abs(t.amount);
    } else if (t.isBusinessExpense && t.category === 'Cost of Goods Sold') {
      cogs[t.subcategory] = (cogs[t.subcategory] || 0) + Math.abs(t.amount);
    } else if (t.isBusinessExpense && t.category === 'Operating Expenses') {
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
