'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOrCreateSessionId, db } from '@/lib/db';

export default function DownloadPage() {
  const router = useRouter();
  const [pnlData, setPnlData] = useState<Record<string, unknown> | null>(null);
  const [businessName, setBusinessName] = useState('Your Business');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    db.reports.where('sessionId').equals(sessionId).last().then((report) => {
      if (!report) {
        router.push('/');
        return;
      }
      const data = JSON.parse(report.reportData);
      setPnlData(data.pnlData);
      setBusinessName(data.pnlData?.businessName || 'Your Business');
      setIsLoading(false);
    });
  }, [router]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  const handleDownloadPDF = async () => {
    const sessionId = getOrCreateSessionId();
    const report = await db.reports.where('sessionId').equals(sessionId).last();
    if (!report) return;

    const data = JSON.parse(report.reportData);
    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnlData: data.pnlData }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${businessName.replace(/\s+/g, '-')}-PnL.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#1B3A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pnl = pnlData as {
    totalRevenue: number; totalCOGS: number; grossProfit: number;
    grossMargin: number; totalOpex: number; netIncome: number;
    netMargin: number; transactionCount: number; period: string;
    reportingBasis: string;
    revenue: Record<string, number>;
    opex: Record<string, number>;
  };

  const periodLabel: Record<string, string> = {
    '3': '3-Month', '6': '6-Month', '12': '12-Month', 'ytd': 'Year-to-Date',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1B3A5C] rounded-md flex items-center justify-center">
            <span className="text-[#C9A84C] text-xs font-bold">FF</span>
          </div>
          <span className="font-bold text-[#1B3A5C] text-sm">Financials Fast</span>
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
          ✓ P&L Complete
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Hero */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-emerald-500 text-3xl">✓</span>
            </div>
            <h1 className="text-xl font-bold text-[#1B3A5C]">Your P&L is ready</h1>
            <p className="text-sm text-slate-500 mt-1">
              {periodLabel[pnl.period] || 'Your'} P&L for {businessName} — lender-ready PDF
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Total Revenue', value: formatCurrency(pnl.totalRevenue), highlight: true },
              { label: 'Net Income', value: formatCurrency(pnl.netIncome), highlight: pnl.netIncome >= 0 },
              { label: 'Gross Margin', value: `${pnl.grossMargin.toFixed(1)}%`, highlight: false },
              { label: 'Net Margin', value: `${pnl.netMargin.toFixed(1)}%`, highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-xl p-4 border ${highlight ? 'bg-[#1B3A5C] border-[#1B3A5C]' : 'bg-white border-slate-200'} shadow-sm`}>
                <p className={`text-xs font-semibold ${highlight ? 'text-blue-200' : 'text-slate-500'}`}>{label}</p>
                <p className={`text-xl font-bold mt-1 ${highlight ? 'text-white' : pnl.netIncome < 0 && label === 'Net Income' ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* P&L summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">P&L Summary</p>
            </div>
            {[
              { label: 'Total Revenue', value: pnl.totalRevenue, bold: true },
              { label: 'Cost of Goods Sold', value: -pnl.totalCOGS, indent: false },
              { label: 'Gross Profit', value: pnl.grossProfit, bold: true, border: true },
              { label: 'Total Operating Expenses', value: -pnl.totalOpex, indent: false },
              { label: 'Net Income', value: pnl.netIncome, bold: true, border: true, highlight: true },
            ].map(({ label, value, bold, border, highlight, indent }) => (
              <div key={label} className={`flex justify-between px-5 py-3 ${border ? 'border-t-2 border-[#1B3A5C]' : 'border-b border-slate-100'} ${highlight ? 'bg-slate-50' : ''}`}>
                <span className={`text-sm ${bold ? 'font-bold text-slate-800' : 'text-slate-600'} ${indent ? 'pl-3' : ''}`}>{label}</span>
                <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${value < 0 ? 'text-red-600' : value > 0 && highlight ? 'text-emerald-700' : 'text-slate-800'}`}>
                  {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
                </span>
              </div>
            ))}
          </div>

          {/* Transaction count */}
          <p className="text-center text-xs text-slate-400 mb-4">
            Based on {pnl.transactionCount.toLocaleString()} transactions · {pnl.reportingBasis === 'cash' ? 'Cash basis' : 'Accrual basis'}
          </p>

          {/* Download CTA */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="w-full py-4 rounded-xl bg-[#C9A84C] text-white font-bold text-base hover:bg-[#b8973f] transition-all shadow-md mb-3"
          >
            📄 Download Lender-Ready PDF
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-slate-300 transition-all"
          >
            Generate Another P&L
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
            <p className="text-sm text-blue-800">
              <strong>Need help?</strong> Share this PDF directly with your lender or accountant.
              The document includes a Notes & Assumptions section explaining the methodology.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
