'use client';

import { useState, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadedDoc {
  id: string;
  file: File;
  category: string;
  name: string;
  size: number;
}

interface NarrativeData {
  businessDescription: string;
  loanPurpose: string;
  challenges: string;
}

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  loanAmount: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'contact', label: 'Contact' },
  { id: 'upload', label: 'Documents' },
  { id: 'narrative', label: 'Business Story' },
  { id: 'review', label: 'Review' },
  { id: 'booking', label: 'Schedule' },
  { id: 'payment', label: 'Payment' },
];

const DOC_CATEGORIES = [
  {
    id: 'personal-tax',
    title: 'Personal Tax Returns',
    desc: 'Last 3 years of personal federal tax returns (1040) — required for SBA loans',
    icon: '\uD83E\uDDFE',
  },
  {
    id: 'bank-statements',
    title: 'Bank Statements',
    desc: 'Last 2\u20133 months from your primary business account',
    icon: '\uD83C\uDFE6',
  },
  {
    id: 'business-tax',
    title: 'Business Tax Returns',
    desc: 'Last 3 years (1120, 1120S, 1065, or Schedule C) — required for SBA loans',
    icon: '\uD83D\uDCCB',
  },
  {
    id: 'pnl',
    title: 'Current Year P&L',
    desc: 'Year-to-date Profit & Loss statement',
    icon: '\uD83D\uDCCA',
  },
  {
    id: 'balance-sheet',
    title: 'Balance Sheet',
    desc: 'Most recent balance sheet',
    icon: '\uD83D\uDCC1',
  },
];

function fmtSize(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UnderwritingPage() {
  const [step, setStep] = useState(0);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [narrative, setNarrative] = useState<NarrativeData>({
    businessDescription: '', loanPurpose: '', challenges: '',
  });
  const [contact, setContact] = useState<ContactInfo>({
    name: '', email: '', phone: '', businessName: '', loanAmount: '',
  });
  const [selectedSlot, setSelectedSlot] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [packetUrl, setPacketUrl] = useState('');
  const [error, setError] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── File handling ──

  const addFiles = useCallback((catId: string, files: FileList) => {
    const newDocs = Array.from(files).map((f) => ({
      id: `${catId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f, category: catId, name: f.name, size: f.size,
    }));
    setDocs((prev) => [...prev, ...newDocs]);
    const ref = inputRefs.current[catId];
    if (ref) ref.value = '';
  }, []);

  const removeDocs = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const docsFor = (catId: string) => docs.filter((d) => d.category === catId);

  // ── Validation ──

  const contactValid = contact.name.trim() && contact.email.includes('@') && contact.businessName.trim();
  const allDocsUploaded = DOC_CATEGORIES.every((c) => docsFor(c.id).length > 0);
  const narrativeValid = narrative.businessDescription.trim().length > 20 && narrative.loanPurpose.trim().length > 20;

  const canProceed = () => {
    if (step === 0) return contactValid;
    if (step === 1) return allDocsUploaded;
    if (step === 2) return narrativeValid;
    if (step === 3) return true;
    if (step === 4) return !!selectedSlot;
    return false;
  };

  // ── Generate packet ──

  const generatePacket = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('contact', JSON.stringify(contact));
      formData.append('narrative', JSON.stringify(narrative));
      formData.append('selectedSlot', selectedSlot);

      // Append all uploaded files
      for (const doc of docs) {
        formData.append(`file_${doc.category}`, doc.file, doc.name);
      }

      // Also send doc manifest
      const manifest = docs.map((d) => ({
        id: d.id, category: d.category, name: d.name, size: d.size,
      }));
      formData.append('manifest', JSON.stringify(manifest));

      const res = await fetch('/api/underwriting/generate-packet', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        setError('Failed to generate packet. Please try again.');
        setIsProcessing(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPacketUrl(url);
      setStep(5);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setIsProcessing(false);
  };

  // ── Handle payment step ──

  const handlePaymentStep = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType: 'underwriting' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          // Save state before redirect
          sessionStorage.setItem('ff_underwriting_contact', JSON.stringify(contact));
          sessionStorage.setItem('ff_underwriting_narrative', JSON.stringify(narrative));
          sessionStorage.setItem('ff_underwriting_slot', selectedSlot);
          window.location.href = data.url;
          return;
        }
      }
      // If checkout session fails, generate packet anyway
      await generatePacket();
    } catch {
      await generatePacket();
    }
    setIsProcessing(false);
  };

  // ── Time slots ──

  const getSlots = () => {
    const days: { label: string; key: string; times: string[] }[] = [];
    const now = new Date();
    let added = 0;
    for (let d = 1; added < 5; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        key: date.toISOString().slice(0, 10),
        times: ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'],
      });
      added++;
    }
    return days;
  };

  const slots = getSlots();

  // ── Render ──

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
        <span className="text-xs text-slate-400">Underwriting Summary</span>
      </nav>

      {/* Stepper */}
      <div className="bg-white border-b border-slate-100 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  i < step ? 'bg-[#C9A84C] text-white'
                  : i === step ? 'bg-[#1B3A5C] text-white ring-2 ring-[#1B3A5C]/15'
                  : 'bg-slate-100 text-slate-400'
                }`}>{i < step ? '\u2713' : i + 1}</div>
                <span className={`text-[11px] font-medium whitespace-nowrap ${
                  i === step ? 'text-[#1B3A5C]' : i < step ? 'text-[#C9A84C]' : 'text-slate-300'
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-2 min-w-[8px] ${i < step ? 'bg-[#C9A84C]' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-[#1B3A5C]/20 border-t-[#C9A84C] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold text-[#1B3A5C]">Preparing your consultation packet...</p>
            <p className="text-sm text-slate-400 mt-1">Compiling documents and generating your summary</p>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-5 py-10">

        {error && (
          <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <span className="text-red-400 mt-0.5 text-sm">{'\u26A0'}</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-300 hover:text-red-500 text-lg leading-none">{'\u00D7'}</button>
          </div>
        )}

        {/* ═══ STEP 0: CONTACT INFO ═══ */}
        {step === 0 && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Let&apos;s get started</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">Tell us about you and your business so your consultant can prepare for your session.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Your full name *</label>
                <input type="text" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  placeholder="John Smith" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email address *</label>
                  <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    placeholder="john@business.com" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Phone number</label>
                  <input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    placeholder="(404) 555-1234" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Business name *</label>
                  <input type="text" value={contact.businessName} onChange={(e) => setContact({ ...contact, businessName: e.target.value })}
                    placeholder="Smith Landscaping LLC" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Loan amount sought</label>
                  <input type="text" value={contact.loanAmount} onChange={(e) => setContact({ ...contact, loanAmount: e.target.value })}
                    placeholder="e.g. $150,000" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 1: UPLOAD DOCUMENTS ═══ */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Upload your documents</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">These are the core documents lenders require for underwriting. Upload what you have — your consultant will review everything and let you know if anything additional is needed for your specific situation.</p>
            </div>
            <div className="space-y-4">
              {DOC_CATEGORIES.map((cat) => {
                const catDocs = docsFor(cat.id);
                const hasDocs = catDocs.length > 0;
                return (
                  <div key={cat.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${hasDocs ? 'border-emerald-200' : 'border-slate-200'}`}>
                    <div className="px-5 py-4 flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0 mt-0.5">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#1B3A5C]">{cat.title}</p>
                          {hasDocs && (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{catDocs.length} uploaded</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{cat.desc}</p>

                        {/* Uploaded files for this category */}
                        {catDocs.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {catDocs.map((d) => (
                              <div key={d.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8 1H3.5a1 1 0 00-1 1v10a1 1 0 001 1h7a1 1 0 001-1V4.5L8 1z" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                <span className="text-xs text-slate-600 flex-1 truncate">{d.name}</span>
                                <span className="text-[10px] text-slate-400">{fmtSize(d.size)}</span>
                                <button onClick={() => removeDocs(d.id)} className="text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <input
                          ref={(el) => { inputRefs.current[cat.id] = el; }}
                          type="file"
                          accept=".pdf,.xlsx,.xls,.csv"
                          multiple
                          onChange={(e) => e.target.files && addFiles(cat.id, e.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputRefs.current[cat.id]?.click()}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                            hasDocs
                              ? 'text-slate-500 border border-slate-200 hover:border-slate-400'
                              : 'text-white bg-[#1B3A5C] hover:bg-[#152e4a]'
                          }`}
                        >
                          {hasDocs ? '+ Add more' : 'Upload'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!allDocsUploaded && (
              <p className="text-xs text-amber-600 mt-4 font-medium">Upload at least one file for each category to continue. Don&apos;t have everything? Upload what you can — your consultant will guide you on the rest.</p>
            )}

            {/* Additional docs notice */}
            <div className="mt-5 bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-[#1B3A5C] mb-1.5">Additional documents may be requested</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Depending on your business structure, loan type, and lender requirements, your consultant may request additional documentation such as articles of incorporation, franchise agreements, commercial leases, insurance certificates, accounts receivable aging, collateral documentation, or other items specific to your situation. Part of the consulting service included in your package is educating you on exactly what underwriters need and why — so you&apos;re never guessing.
              </p>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: NARRATIVE ═══ */}
        {step === 2 && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Tell us your story</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">These responses help your consultant understand your business and prepare meaningful guidance for your session.</p>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <label className="text-sm font-bold text-[#1B3A5C] block mb-1">Describe your business and its current stage *</label>
                <p className="text-xs text-slate-400 mb-3">What do you do, how long have you been operating, how many employees, what&apos;s your annual revenue?</p>
                <textarea
                  value={narrative.businessDescription}
                  onChange={(e) => setNarrative({ ...narrative, businessDescription: e.target.value })}
                  placeholder="We're a residential landscaping company based in Atlanta, operating for 4 years with 6 employees. Annual revenue is approximately $420,000..."
                  rows={5}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{narrative.businessDescription.length} characters</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <label className="text-sm font-bold text-[#1B3A5C] block mb-1">What is the loan for and how will it impact your business? *</label>
                <p className="text-xs text-slate-400 mb-3">Be specific about the amount, what you&apos;ll use it for, and the expected return.</p>
                <textarea
                  value={narrative.loanPurpose}
                  onChange={(e) => setNarrative({ ...narrative, loanPurpose: e.target.value })}
                  placeholder="We're seeking $150,000 to purchase a second crew truck and equipment, which would allow us to take on 40% more jobs per month..."
                  rows={5}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{narrative.loanPurpose.length} characters</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <label className="text-sm font-bold text-[#1B3A5C] block mb-1">Are there any major challenges or upcoming changes we should know about?</label>
                <p className="text-xs text-slate-400 mb-3">Pending lawsuits, partner changes, lease expirations, seasonal dips, industry shifts — anything relevant.</p>
                <textarea
                  value={narrative.challenges}
                  onChange={(e) => setNarrative({ ...narrative, challenges: e.target.value })}
                  placeholder="Our lease expires in 6 months and we're negotiating a renewal. Also, one of our largest clients is switching to a quarterly payment schedule..."
                  rows={4}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: REVIEW PACKET ═══ */}
        {step === 3 && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Review your packet</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">Everything below will be compiled into a professional consultation packet for your advisor.</p>
            </div>

            {/* Contact summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider">Contact Information</p>
                <button onClick={() => setStep(0)} className="text-xs text-[#C9A84C] font-semibold hover:underline">Edit</button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-slate-400">Name:</span> <span className="text-slate-700 font-medium">{contact.name}</span></div>
                <div><span className="text-slate-400">Business:</span> <span className="text-slate-700 font-medium">{contact.businessName}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className="text-slate-700 font-medium">{contact.email}</span></div>
                <div><span className="text-slate-400">Loan Amount:</span> <span className="text-slate-700 font-medium">{contact.loanAmount || 'Not specified'}</span></div>
              </div>
            </div>

            {/* Documents summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider">Documents ({docs.length} files)</p>
                <button onClick={() => setStep(1)} className="text-xs text-[#C9A84C] font-semibold hover:underline">Edit</button>
              </div>
              <div className="space-y-2">
                {DOC_CATEGORIES.map((cat) => {
                  const catDocs = docsFor(cat.id);
                  return (
                    <div key={cat.id} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                        catDocs.length > 0 ? 'bg-emerald-500 text-white' : 'bg-red-100 text-red-500'
                      }`}>{catDocs.length > 0 ? '\u2713' : '!'}</div>
                      <span className="text-sm text-slate-600 flex-1">{cat.title}</span>
                      <span className="text-xs text-slate-400">{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Narrative summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider">Business Narrative</p>
                <button onClick={() => setStep(2)} className="text-xs text-[#C9A84C] font-semibold hover:underline">Edit</button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Business Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{narrative.businessDescription || <span className="text-slate-400 italic">Not provided</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Loan Purpose & Impact</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{narrative.loanPurpose || <span className="text-slate-400 italic">Not provided</span>}</p>
                </div>
                {narrative.challenges && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Challenges & Changes</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{narrative.challenges}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: BOOKING ═══ */}
        {step === 4 && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Schedule your consultation</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">Select a time for your initial consultation. Your advisor will review your packet before the call.</p>
            </div>
            <div className="space-y-4">
              {slots.map((day) => (
                <div key={day.key} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-sm font-bold text-[#1B3A5C] mb-3">{day.label}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {day.times.map((t) => {
                      const slotKey = `${day.key}_${t}`;
                      const isSelected = selectedSlot === slotKey;
                      return (
                        <button key={slotKey} type="button" onClick={() => setSelectedSlot(slotKey)}
                          className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#1B3A5C] text-white shadow-sm'
                              : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-[#1B3A5C]'
                          }`}
                        >{t}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 5: PAYMENT & CONFIRMATION ═══ */}
        {step === 5 && (
          <div>
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M8 17l5 5L24 11" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1B3A5C] tracking-[-0.02em]">Your consultation is booked</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Your packet has been compiled and is ready to share with your consultant.
              </p>
            </div>

            {/* Meeting details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-4">
              <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider mb-4">Consultation Details</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Client</span>
                  <span className="text-slate-700 font-medium">{contact.name} — {contact.businessName}</span>
                </div>
                {selectedSlot && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Scheduled</span>
                    <span className="text-slate-700 font-medium">
                      {(() => {
                        const [date, time] = selectedSlot.split('_');
                        return `${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${time}`;
                      })()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-slate-700 font-medium">Up to 4 hours (across sessions)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Documents</span>
                  <span className="text-slate-700 font-medium">{docs.length} files uploaded</span>
                </div>
              </div>
            </div>

            {/* Download packet */}
            {packetUrl && (
              <a
                href={packetUrl}
                download={`${contact.businessName.replace(/\s+/g, '_')}_Consultation_Packet.pdf`}
                className="block w-full py-3.5 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm text-center hover:bg-[#152e4a] active:scale-[0.99] transition-all shadow-sm mb-4"
              >
                Download Consultation Packet (PDF)
              </a>
            )}

            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">What happens next?</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Your consultant will review your uploaded documents and narrative before your call. During the consultation, they&apos;ll walk you through what underwriters look for, identify any strengths or gaps in your application, and may request additional documentation specific to your situation — such as lease agreements, insurance certificates, or collateral documentation. After the consultation, you&apos;ll receive a complete underwriting package ready for lender submission.
              </p>
            </div>
          </div>
        )}

        {/* ═══ NAVIGATION ═══ */}
        {step < 5 && (
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)}
                className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-slate-500 font-semibold text-sm hover:border-slate-300 hover:text-slate-700 transition-all">
                {'\u2190'} Back
              </button>
            )}
            {step === 0 && (
              <a href="/" className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-slate-500 font-semibold text-sm hover:border-slate-300 hover:text-slate-700 transition-all text-center">
                {'\u2190'} Home
              </a>
            )}
            {step < 4 && (
              <button type="button" onClick={() => { setError(''); setStep(step + 1); }}
                disabled={!canProceed()}
                className={`flex-[2] py-3.5 rounded-xl font-bold text-sm transition-all ${
                  canProceed()
                    ? 'bg-[#1B3A5C] text-white hover:bg-[#152e4a] active:scale-[0.99] shadow-sm'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}>
                Continue {'\u2192'}
              </button>
            )}
            {step === 4 && (
              <button type="button" onClick={generatePacket}
                disabled={!selectedSlot || isProcessing}
                className={`flex-[2] py-3.5 rounded-xl font-bold text-sm transition-all ${
                  selectedSlot
                    ? 'bg-[#C9A84C] text-white hover:bg-[#b8953e] active:scale-[0.99] shadow-sm'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}>
                Confirm & Generate Packet {'\u2192'}
              </button>
            )}
          </div>
        )}

        {/* Privacy */}
        {step < 5 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="7" rx="1.5" stroke="#94A3B8" strokeWidth="1.5"/><path d="M5 6V4.5a2 2 0 014 0V6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <p className="text-[11px] text-slate-400">Your documents are encrypted and shared only with your assigned consultant</p>
          </div>
        )}

      </main>
    </div>
  );
}
