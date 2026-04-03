'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOrCreateSessionId,
  saveUploadedFile,
  getUploadedFiles,
  getQuestionnaireData,
  type UploadedFile,
} from '@/lib/db';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRequiredMonths(period: string): { month: string; year: string; label: string; shortLabel: string }[] {
  const now = new Date();
  const count = period === 'ytd'
    ? now.getMonth() + 1
    : parseInt(period || '3', 10);
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: String(d.getMonth() + 1).padStart(2, '0'),
      year: String(d.getFullYear()),
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      shortLabel: d.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return months;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [requiredMonths, setRequiredMonths] = useState<ReturnType<typeof getRequiredMonths>>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dataSource, setDataSource] = useState<'bank' | 'quickbooks' | null>(null);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbPulling, setQbPulling] = useState(false);
  const [qbData, setQbData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qb_connected') === 'true') {
        setQbConnected(true);
        setDataSource('quickbooks');
        window.history.replaceState({}, '', '/upload');
      }
      if (params.get('qb_error')) {
        setError(params.get('qb_error') || 'QuickBooks connection failed');
        setDataSource(null);
        window.history.replaceState({}, '', '/upload');
      }
    }
    getQuestionnaireData(sid).then((data) => {
      if (!data) { router.push('/questionnaire'); return; }
      setBusinessName(data.businessName || '');
      const months = getRequiredMonths(data.statementPeriod || '3');
      setRequiredMonths(months);
      if (months.length > 0) setSelectedMonth(`${months[0].year}-${months[0].month}`);
    });
    getUploadedFiles(sid).then(setUploadedFiles);
  }, [router]);

  const refreshFiles = async () => { setUploadedFiles(await getUploadedFiles(sessionId)); };

  const handleFiles = async (files: FileList) => {
    setError(''); setIsUploading(true);
    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') { setError(`"${file.name}" is not a PDF.`); setIsUploading(false); return; }
      if (file.size > 50 * 1024 * 1024) { setError(`"${file.name}" exceeds 50 MB.`); setIsUploading(false); return; }
      const [year, month] = selectedMonth.split('-');
      try {
        await Promise.race([
          saveUploadedFile(sessionId, file, month, year),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ]);
      } catch { setError(`Upload failed for "${file.name}".`); setIsUploading(false); return; }
    }
    await refreshFiles(); setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files); };
  const removeFile = async (id: string | undefined) => { if (!id) return; const { db } = await import('@/lib/db'); await db.uploadedFiles.delete(String(id)); await refreshFiles(); };

  const coveredMonths = new Set(uploadedFiles.map((f) => `${f.statementYear}-${f.statementMonth}`));
  const missingMonths = requiredMonths.filter((m) => !coveredMonths.has(`${m.year}-${m.month}`));
  const allCovered = missingMonths.length === 0 && requiredMonths.length > 0;
  const canContinue = (dataSource === 'bank' && allCovered) || (dataSource === 'quickbooks' && !!qbData);

  const handleContinue = () => {
    if (dataSource === 'quickbooks' && qbData) { router.push('/checkout'); return; }
    if (!allCovered) { setError(`Missing: ${missingMonths.map((m) => m.label).join(', ')}`); return; }
    router.push('/checkout');
  };

  const handleQbConnect = () => { window.location.href = '/api/quickbooks/connect'; };

  const handleQbPull = async () => {
    setQbPulling(true); setError('');
    try {
      const startDate = requiredMonths.length > 0 ? `${requiredMonths[0].year}-${requiredMonths[0].month}-01` : undefined;
      const endDate = requiredMonths.length > 0 ? (() => {
        const last = requiredMonths[requiredMonths.length - 1];
        const d = new Date(parseInt(last.year), parseInt(last.month), 0);
        return `${last.year}-${last.month}-${String(d.getDate()).padStart(2, '0')}`;
      })() : undefined;
      const res = await fetch('/api/quickbooks/pull-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate, endDate }) });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Failed to pull data'); if (res.status === 401) setQbConnected(false); setQbPulling(false); return; }
      setQbData(await res.json()); setQbPulling(false);
    } catch { setError('Connection error. Please try again.'); setQbPulling(false); }
  };

  const steps = [
    { label: 'P&L', done: true },
    { label: 'Balance Sheet', done: true },
    { label: 'Import Data', done: false, active: true },
    { label: 'Review & Pay', done: false },
  ];

  return (
    <div className="min-h-screen bg-[#FAFBFD]" style={{ fontFamily: "'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
            <span className="text-[#C9A84C] text-xs font-bold tracking-tight">FF</span>
          </div>
          <span className="font-bold text-[#1B3A5C] text-[15px] tracking-[-0.02em]">Financials<span className="text-[#C9A84C]">Fast</span></span>
        </a>
        {businessName && <span className="text-xs text-slate-400 hidden sm:block">{businessName}</span>}
      </nav>

      {/* Progress Steps */}
      <div className="bg-white border-b border-slate-100 px-6 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all ${step.done ? 'bg-[#C9A84C] text-white' : step.active ? 'bg-[#1B3A5C] text-white ring-4 ring-[#1B3A5C]/10' : 'bg-slate-100 text-slate-400'}`}>
                  {step.done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step.done ? 'text-[#C9A84C]' : step.active ? 'text-[#1B3A5C]' : 'text-slate-300'}`}>{step.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-px flex-1 mx-2 ${step.done ? 'bg-[#C9A84C]' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="max-w-xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Import your financial data</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">Choose how you&apos;d like to provide your transaction data. QuickBooks gives the fastest, most accurate results.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <span className="text-red-400 mt-0.5 text-sm">⚠</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-300 hover:text-red-500 text-lg leading-none">×</button>
          </div>
        )}

        {/* ═══ SOURCE SELECTOR ═══ */}
        {!dataSource && (
          <div className="space-y-4">
            <button type="button" onClick={handleQbConnect} className="group w-full bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm hover:border-[#2CA01C] hover:shadow-md transition-all duration-200 text-left relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-[11px] font-semibold text-[#2CA01C] bg-emerald-50 px-2.5 py-1 rounded-full">Recommended</span>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#2CA01C] rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">QB</span>
                </div>
                <div className="flex-1 pr-16">
                  <p className="font-bold text-[#1B3A5C] text-[15px]">Connect QuickBooks</p>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">Import your P&amp;L and Balance Sheet directly. Pre-categorized transactions mean faster, more accurate financials.</p>
                  <div className="flex gap-4 mt-3">
                    <span className="text-[11px] text-slate-400">~2 minutes</span>
                    <span className="text-[11px] text-slate-400">Secure OAuth 2.0</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 h-px bg-slate-100 group-hover:bg-emerald-100 transition-colors" />
              <p className="mt-3 text-xs text-[#2CA01C] font-semibold group-hover:translate-x-1 transition-transform">Connect &amp; Import →</p>
            </button>

            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-300 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button type="button" onClick={() => setDataSource('bank')} className="group w-full bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm hover:border-[#1B3A5C] hover:shadow-md transition-all duration-200 text-left">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#1B3A5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#1B3A5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#1B3A5C] text-[15px]">Upload Bank Statements</p>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">Upload {requiredMonths.length} monthly PDF statement{requiredMonths.length !== 1 ? 's' : ''} from your bank. Our AI classifies every transaction.</p>
                  <div className="flex gap-4 mt-3">
                    <span className="text-[11px] text-slate-400">~5 minutes</span>
                    <span className="text-[11px] text-slate-400">PDF files only</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 h-px bg-slate-100 group-hover:bg-blue-50 transition-colors" />
              <p className="mt-3 text-xs text-[#1B3A5C] font-semibold group-hover:translate-x-1 transition-transform">Upload Statements →</p>
            </button>
          </div>
        )}

        {/* ═══ QUICKBOOKS CONNECTED ═══ */}
        {dataSource === 'quickbooks' && qbConnected && !qbData && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-white px-6 py-5 border-b border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 10.5L8.5 13L14 7.5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <p className="font-bold text-emerald-900 text-[15px]">QuickBooks Connected</p>
                  <p className="text-emerald-700 text-xs mt-0.5">Your account is linked and ready to import</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                We&apos;ll pull your Profit &amp; Loss and Balance Sheet
                {requiredMonths.length > 0 && <span className="text-slate-400"> for {requiredMonths[0]?.label} – {requiredMonths[requiredMonths.length - 1]?.label}</span>}.
              </p>
              <button type="button" onClick={handleQbPull} disabled={qbPulling} className="w-full py-3.5 rounded-xl bg-[#2CA01C] text-white font-bold text-sm hover:bg-[#248a17] active:scale-[0.99] transition-all disabled:opacity-60">
                {qbPulling ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Importing from QuickBooks...
                  </span>
                ) : 'Import Financial Data'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ QUICKBOOKS DATA IMPORTED ═══ */}
        {dataSource === 'quickbooks' && qbData && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-white px-6 py-5 border-b border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#C9A84C] rounded-full flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 10.5L8.5 13L14 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div>
                  <p className="font-bold text-emerald-900 text-[15px]">Data imported successfully</p>
                  <p className="text-emerald-700 text-xs mt-0.5">
                    {(qbData as Record<string, unknown>).companyInfo ? ((qbData as Record<string, unknown>).companyInfo as Record<string, string>).companyName || businessName : businessName || 'Your business'}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                {['Profit & Loss', 'Balance Sheet'].map((doc) => (
                  <div key={doc} className="bg-emerald-50/60 rounded-xl p-4 text-center border border-emerald-100">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2"><span className="text-emerald-600 text-xs font-bold">{doc === 'Profit & Loss' ? 'P&L' : 'BS'}</span></div>
                    <p className="text-xs text-emerald-800 font-semibold">{doc}</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Imported ✓</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ BANK STATEMENT UPLOAD ═══ */}
        {dataSource === 'bank' && (<>
          {requiredMonths.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-4">
              <p className="text-sm font-bold text-[#1B3A5C] mb-1">Select statement month</p>
              <p className="text-xs text-slate-400 mb-4">Choose which month, then drop the PDF below.</p>
              <div className="grid grid-cols-3 gap-2">
                {requiredMonths.map((m) => {
                  const key = `${m.year}-${m.month}`;
                  const covered = coveredMonths.has(key);
                  return (
                    <button key={key} type="button" onClick={() => setSelectedMonth(key)} className={`relative text-center px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${selectedMonth === key ? 'bg-[#1B3A5C] text-white border-[#1B3A5C] shadow-sm' : covered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-transparent hover:border-[#1B3A5C] hover:bg-white'}`}>
                      <span className="text-xs">{m.shortLabel}</span>
                      <span className="text-[10px] opacity-60 ml-1">{m.year.slice(2)}</span>
                      {covered && selectedMonth !== key && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><span className="text-white text-[8px]">✓</span></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div onDragEnter={() => setIsDragging(true)} onDragLeave={() => setIsDragging(false)} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`bg-white rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200 shadow-sm ${isDragging ? 'border-[#C9A84C] bg-amber-50/50 scale-[1.01]' : 'border-slate-200 hover:border-[#1B3A5C] hover:bg-slate-50/50'}`}>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleFileInput} className="hidden" />
            {isUploading ? (
              <><div className="w-10 h-10 border-[3px] border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin mx-auto mb-3" /><p className="font-semibold text-[#1B3A5C] text-sm">Uploading...</p></>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto"><rect width="40" height="40" rx="12" fill="#F1F5F9"/><path d="M20 13v10m0-10l-3.5 3.5M20 13l3.5 3.5" stroke="#1B3A5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 23v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="#1B3A5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <p className="font-semibold text-[#1B3A5C] text-sm mt-3">Drop your PDF here or <span className="text-[#C9A84C] underline underline-offset-2">browse</span></p>
                <p className="text-xs text-slate-400 mt-1.5">PDF only · Max 50 MB</p>
              </>
            )}
          </div>

          {/* Help */}
          <details className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <summary className="text-xs font-semibold text-slate-500 cursor-pointer px-4 py-3 hover:bg-slate-50 transition-colors">Need help downloading your bank statement?</summary>
            <div className="px-4 pb-4 space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
              <p><span className="font-semibold text-slate-600">Chase:</span> Accounts → Statements → choose month → Download PDF</p>
              <p><span className="font-semibold text-slate-600">Bank of America:</span> Statements &amp; Documents → select period → Download</p>
              <p><span className="font-semibold text-slate-600">Wells Fargo:</span> Statements → date range → Download</p>
              <p><span className="font-semibold text-slate-600">Others:</span> Look for &quot;Statements&quot; in your online banking</p>
            </div>
          </details>

          {/* Uploaded files */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-[#1B3A5C]">Uploaded · {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</p>
                <span className="text-[11px] text-slate-400">{coveredMonths.size} of {requiredMonths.length} months</span>
              </div>
              <div className="divide-y divide-slate-50">
                {uploadedFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 1v4h4" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{f.fileName}</p>
                      <p className="text-[11px] text-slate-400">{new Date(f.statementYear + '-' + f.statementMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {formatFileSize(f.fileSize)}</p>
                    </div>
                    <button type="button" onClick={() => removeFile(f.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage */}
          {requiredMonths.length > 0 && (
            <div className={`mt-4 rounded-xl border p-4 transition-colors ${allCovered ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
              {allCovered ? (
                <p className="text-sm text-emerald-800 font-semibold flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#C9A84C"/><path d="M6 10.5L8.5 13L14 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  All {requiredMonths.length} months covered — ready to continue
                </p>
              ) : (
                <div>
                  <p className="text-xs text-amber-800 font-semibold mb-2">Still needed:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingMonths.map((m) => <span key={`${m.year}-${m.month}`} className="text-[11px] bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-medium">{m.shortLabel} {m.year.slice(2)}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>)}

        {/* Switch source */}
        {dataSource && !qbData && (
          <button type="button" onClick={() => { setDataSource(null); setQbConnected(false); setError(''); }} className="text-xs text-slate-400 hover:text-[#1B3A5C] mt-5 block transition-colors">← Choose a different import method</button>
        )}

        {/* Navigation */}
        {dataSource && (
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={() => router.push('/questionnaire/balance-sheet')} className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-slate-500 font-semibold text-sm hover:border-slate-300 hover:text-slate-700 transition-all">← Back</button>
            <button type="button" onClick={handleContinue} disabled={!canContinue} className={`flex-[2] py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${canContinue ? 'bg-[#1B3A5C] text-white hover:bg-[#152e4a] active:scale-[0.99] shadow-sm' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>Continue to Payment →</button>
          </div>
        )}

        {/* Privacy */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="7" rx="1.5" stroke="#94A3B8" strokeWidth="1.5"/><path d="M5 6V4.5a2 2 0 014 0V6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <p className="text-[11px] text-slate-400">Your data is processed securely and never stored on our servers</p>
        </div>
      </main>
    </div>
  );
}
