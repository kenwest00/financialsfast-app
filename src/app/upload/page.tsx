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

function getRequiredMonths(period: string): { month: string; year: string; label: string }[] {
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
  const [requiredMonths, setRequiredMonths] = useState<ReturnType<typeof getRequiredMonths>>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);

    // Load questionnaire to determine required months
    getQuestionnaireData(sid).then((data) => {
      if (!data) {
        // No questionnaire data — redirect back
        router.push('/questionnaire');
        return;
      }
      const months = getRequiredMonths(data.statementPeriod || '3');
      setRequiredMonths(months);
      if (months.length > 0) setSelectedMonth(`${months[0].year}-${months[0].month}`);
    });

    // Load already-uploaded files
    getUploadedFiles(sid).then(setUploadedFiles);
  }, [router]);

  const refreshFiles = async () => {
    const files = await getUploadedFiles(sessionId);
    setUploadedFiles(files);
  };

  const handleFiles = async (files: FileList) => {
    setError('');
    setIsUploading(true);

    for (const file of Array.from(files)) {
      // Validate
      if (file.type !== 'application/pdf') {
        setError(`"${file.name}" is not a PDF. Please upload PDF bank statements only.`);
        setIsUploading(false);
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError(`"${file.name}" is too large (max 50 MB).`);
        setIsUploading(false);
        return;
      }

      const [year, month] = selectedMonth.split('-');

      // Save with timeout — large PDFs can be slow in IndexedDB
      try {
        await Promise.race([
          saveUploadedFile(sessionId, file, month, year),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 15000)
          ),
        ]);
      } catch {
        setError(`"${file.name}" took too long to save. Try a smaller file or refresh and try again.`);
        setIsUploading(false);
        return;
      }
    }

    await refreshFiles();
    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = async (id: string | undefined) => {
    if (!id) return;
    const { db } = await import('@/lib/db');
    await db.uploadedFiles.delete(String(id));
    await refreshFiles();
  };

  // Check which months are covered
  const coveredMonths = new Set(
    uploadedFiles.map((f) => `${f.statementYear}-${f.statementMonth}`)
  );
  const missingMonths = requiredMonths.filter(
    (m) => !coveredMonths.has(`${m.year}-${m.month}`)
  );
  const allCovered = missingMonths.length === 0 && requiredMonths.length > 0;

  const handleContinue = () => {
    if (!allCovered) {
      setError(`Please upload statements for: ${missingMonths.map((m) => m.label).join(', ')}.`);
      return;
    }
    router.push('/checkout');
  };

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
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#C9A84C] rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
          <span className="text-xs text-slate-500">Questionnaire complete</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-200">
        <div className="h-1 bg-[#C9A84C] transition-all duration-500" style={{ width: '66%' }} />
      </div>

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1B3A5C]">Upload Bank Statements</h1>
            <p className="text-sm text-slate-500 mt-1">
              We need {requiredMonths.length} monthly PDF statement{requiredMonths.length !== 1 ? 's' : ''} from your bank.
              These never leave your session — they&apos;re processed locally.
            </p>
          </div>

          {/* Month selector */}
          {requiredMonths.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Which month are you uploading?</p>
              <div className="grid grid-cols-2 gap-2">
                {requiredMonths.map((m) => {
                  const key = `${m.year}-${m.month}`;
                  const covered = coveredMonths.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedMonth(key)}
                      className={`relative text-left px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                        selectedMonth === key
                          ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                          : covered
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
                      }`}
                    >
                      {m.label}
                      {covered && selectedMonth !== key && (
                        <span className="absolute top-1 right-2 text-emerald-500 text-xs">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`bg-white rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all shadow-sm ${
              isDragging
                ? 'border-[#C9A84C] bg-amber-50'
                : 'border-slate-300 hover:border-[#1B3A5C]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-4xl mb-3">📄</div>
            <p className="font-semibold text-slate-700 text-sm">
              {isUploading ? 'Uploading...' : 'Drop your PDF here or click to browse'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF only · Max 50 MB · Bank statements only</p>
          </div>

          {/* How to download guide */}
          <details className="mt-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <summary className="text-sm font-semibold text-[#1B3A5C] cursor-pointer">
              📥 How to download your bank statement
            </summary>
            <div className="mt-3 space-y-3 text-xs text-slate-600">
              {[
                { bank: 'Chase', steps: ['Log in → Accounts tab → select account', 'Click "Statements" in left menu', 'Choose month → Download PDF'] },
                { bank: 'Bank of America', steps: ['Log in → select account', 'Statements & Documents (top nav)', 'Select period → Download PDF'] },
                { bank: 'Wells Fargo', steps: ['Log in → select account', 'Statements tab', 'Choose date range → View & Download'] },
                { bank: 'Other Banks', steps: ['Look for "Statements" or "Documents" in your account', 'Select the correct month', 'Download as PDF'] },
              ].map(({ bank, steps }) => (
                <div key={bank}>
                  <p className="font-semibold text-slate-700">{bank}</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-500 mt-1">
                    {steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </details>

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Uploaded ({uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''})
              </p>
              <div className="space-y-2">
                {uploadedFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700 truncate max-w-[240px]">
                        {f.fileName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(f.statementYear + '-' + f.statementMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {formatFileSize(f.fileSize)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="text-slate-400 hover:text-red-500 text-lg ml-3"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage summary */}
          {requiredMonths.length > 0 && (
            <div className={`mt-4 rounded-xl border p-4 ${allCovered ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              {allCovered ? (
                <p className="text-sm text-emerald-800 font-semibold">
                  ✓ All {requiredMonths.length} months covered — you&apos;re ready to continue.
                </p>
              ) : (
                <div>
                  <p className="text-sm text-amber-800 font-semibold mb-1">
                    Still needed:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missingMonths.map((m) => (
                      <span
                        key={`${m.year}-${m.month}`}
                        className="text-xs bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded-full"
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => router.push('/questionnaire')}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-slate-300 transition-all"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className={`flex-[2] py-3 rounded-xl font-bold text-sm transition-all ${
                allCovered
                  ? 'bg-[#1B3A5C] text-white hover:bg-[#152e4a]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Continue to Payment →
            </button>
          </div>

          {/* Privacy note */}
          <p className="text-center text-xs text-slate-400 mt-4">
            🔒 Your statements are stored locally in your browser. We never upload them to any server.
          </p>
        </div>
      </main>
    </div>
  );
}
