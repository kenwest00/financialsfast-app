'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOrCreateSessionId,
  saveQuestionnaireProgress,
  getQuestionnaireData,
  type QuestionnaireData,
} from '@/lib/db';

// ─── Types ──────────────────────────────────────────────────────────────────

type FormData = Partial<QuestionnaireData>;

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_PROCESSORS = [
  'Stripe', 'Square', 'PayPal', 'Venmo for Business', 'Cash App for Business',
  'Zelle', 'Shopify Payments', 'Clover', 'Toast', 'QuickBooks Payments', 'Other',
];

const AD_PLATFORMS = [
  'Google Ads', 'Meta (Facebook/Instagram)', 'TikTok Ads', 'LinkedIn Ads',
  'Twitter/X Ads', 'Pinterest Ads', 'YouTube Ads', 'Programmatic/Display', 'Other',
];

const INSURANCE_TYPES = [
  'General Liability', 'Professional Liability / E&O', 'Business Owners Policy (BOP)',
  'Workers Comp', 'Commercial Auto', 'Cyber Liability', 'Health Insurance', 'Other',
];

const INDUSTRIES = [
  'Retail', 'Restaurant / Food Service', 'Professional Services', 'Healthcare',
  'Construction / Trades', 'Real Estate', 'Technology / Software', 'Creative / Media',
  'Transportation / Logistics', 'Manufacturing', 'Education', 'Fitness / Wellness',
  'Beauty / Personal Care', 'Home Services', 'E-commerce', 'Other',
];

// ─── Section definitions ─────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'A', title: 'Business Identity', description: "Let's start with who you are" },
  { id: 'B', title: 'Revenue', description: 'How money comes in' },
  { id: 'C', title: 'Cost of Goods Sold', description: 'Direct costs of your product or service' },
  { id: 'D1', title: 'Operating Expenses — Services', description: 'Recurring subscriptions and services' },
  { id: 'D2', title: 'Operating Expenses — Operations', description: 'Day-to-day operational costs' },
  { id: 'E', title: 'Personal vs. Business', description: 'Separating business from personal spending' },
  { id: 'F', title: 'Report Preferences', description: 'How you want your P&L structured' },
  { id: 'G', title: 'Anything Unusual?', description: 'One-time events or context we should know' },
];

// ─── Helper components ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700 mb-1">{children}</label>;
}

function HintText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 mt-1">{children}</p>;
}

function TextInput({
  value, onChange, placeholder, name,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; name?: string;
}) {
  return (
    <input
      type="text"
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:border-transparent"
    />
  );
}

function TextArea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:border-transparent resize-none"
    />
  );
}

function Select({
  value, onChange, children, name,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; name?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] bg-white"
    >
      {children}
    </select>
  );
}

function YesNo({
  value, onChange, label,
}: {
  value: boolean | undefined; onChange: (v: boolean) => void; label?: string;
}) {
  return (
    <div className="flex gap-3">
      {[true, false].map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
            value === opt
              ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
          }`}
        >
          {opt ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

function CheckboxGroup({
  options, values, onChange,
}: {
  options: string[]; values: string[]; onChange: (vals: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(
      values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]
    );
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`text-left px-3 py-2 rounded-lg text-sm border-2 transition-all ${
            values.includes(opt)
              ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ConfirmationCard({ message }: { message: string }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-start">
      <span className="text-emerald-500 text-lg">✓</span>
      <p className="text-sm text-emerald-800">{message}</p>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function SectionA({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Legal Business Name</Label>
        <TextInput
          value={form.businessName || ''}
          onChange={(v) => update({ businessName: v })}
          placeholder="e.g. Magnolia Supply LLC"
        />
      </div>
      <div>
        <Label>What type of business do you operate?</Label>
        <TextArea
          value={form.businessDescription || ''}
          onChange={(v) => update({ businessDescription: v })}
          placeholder="Briefly describe what your business does and who your customers are"
        />
      </div>
      <div>
        <Label>Industry</Label>
        <Select value={form.industry || ''} onChange={(v) => update({ industry: v })}>
          <option value="">Select your industry</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </Select>
      </div>
      <div>
        <Label>Business Entity Type</Label>
        <Select value={form.entityType || ''} onChange={(v) => update({ entityType: v })}>
          <option value="">Select entity type</option>
          {['Sole Proprietor / 1099', 'Single-Member LLC', 'Multi-Member LLC', 'S-Corp', 'C-Corp', 'Partnership'].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>How many people work in this business (including you)?</Label>
        <Select value={form.employeeCount || ''} onChange={(v) => update({ employeeCount: v })}>
          <option value="">Select</option>
          {['Just me', '2–5', '6–10', '11–25', '26+'].map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>
      {form.employeeCount && form.employeeCount !== 'Just me' && (
        <div>
          <Label>Worker types (select all that apply)</Label>
          <CheckboxGroup
            options={['W-2 Employees', '1099 Contractors', 'Both']}
            values={form.workerTypes || []}
            onChange={(v) => update({ workerTypes: v })}
          />
        </div>
      )}
    </div>
  );
}

function SectionB({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Describe your main revenue sources</Label>
        <TextArea
          value={form.primaryRevenueSources || ''}
          onChange={(v) => update({ primaryRevenueSources: v })}
          placeholder="e.g. Product sales on Shopify, consulting retainers, event bookings"
        />
      </div>
      <div>
        <Label>Which payment processors do you use? (select all that apply)</Label>
        <CheckboxGroup
          options={PAYMENT_PROCESSORS}
          values={form.paymentProcessors || []}
          onChange={(v) => update({ paymentProcessors: v })}
        />
        {(form.paymentProcessors || []).includes('Other') && (
          <div className="mt-2">
            <TextInput
              value={form.otherPaymentProcessors || ''}
              onChange={(v) => update({ otherPaymentProcessors: v })}
              placeholder="Describe other payment processors"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Do you have recurring or subscription revenue?</Label>
        <YesNo
          value={form.hasRecurringRevenue}
          onChange={(v) => update({ hasRecurringRevenue: v })}
        />
        {form.hasRecurringRevenue && (
          <div className="mt-2">
            <TextInput
              value={form.recurringRevenueDescription || ''}
              onChange={(v) => update({ recurringRevenueDescription: v })}
              placeholder="e.g. Monthly retainers ~$2,500/month, annual subscriptions ~$500/year"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionC({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Is your business primarily service-based (no physical product)?</Label>
        <YesNo
          value={form.isServiceBusiness}
          onChange={(v) => update({ isServiceBusiness: v, skipCOGS: v })}
        />
        <HintText>Service businesses (consultants, agencies, therapists, coaches) typically have no Cost of Goods Sold.</HintText>
      </div>
      {!form.isServiceBusiness && (
        <>
          <div>
            <Label>Who are your main inventory or product vendors?</Label>
            <TextArea
              value={form.inventoryVendors || ''}
              onChange={(v) => update({ inventoryVendors: v })}
              placeholder="e.g. Sysco, US Foods, Amazon Business, Alibaba, local wholesalers"
            />
          </div>
          <div>
            <Label>Is direct labor (wages paid to produce your product) included in your cost of goods?</Label>
            <YesNo
              value={form.directLaborIncluded}
              onChange={(v) => update({ directLaborIncluded: v })}
            />
          </div>
          <div>
            <Label>Is shipping and fulfillment a significant cost of delivering your product?</Label>
            <YesNo
              value={form.shippingInCOGS}
              onChange={(v) => update({ shippingInCOGS: v })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SectionD1({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Software subscriptions you pay for regularly</Label>
        <TextArea
          value={form.softwareSubscriptions || ''}
          onChange={(v) => update({ softwareSubscriptions: v })}
          placeholder="e.g. QuickBooks $50/mo, Slack $15/mo, Adobe $55/mo, Shopify $79/mo"
        />
        <HintText>These show up as recurring charges — naming them helps us classify them as business expenses.</HintText>
      </div>
      <div>
        <Label>Do you run paid advertising? (select all that apply)</Label>
        <CheckboxGroup
          options={AD_PLATFORMS}
          values={form.advertisingPlatforms || []}
          onChange={(v) => update({ advertisingPlatforms: v })}
        />
      </div>
      <div>
        <Label>Do you pay for office or retail space?</Label>
        <YesNo value={form.hasOfficeRent} onChange={(v) => update({ hasOfficeRent: v })} />
        {form.hasOfficeRent && (
          <div className="mt-2">
            <TextInput
              value={form.rentAmount || ''}
              onChange={(v) => update({ rentAmount: v })}
              placeholder="Monthly rent amount (e.g. $2,400)"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Professional services you pay for (accountants, lawyers, consultants, etc.)</Label>
        <TextInput
          value={form.professionalServices || ''}
          onChange={(v) => update({ professionalServices: v })}
          placeholder="e.g. CPA $200/mo, attorney retainer $500/quarter"
        />
      </div>
      <div>
        <Label>Do you carry business insurance?</Label>
        <YesNo value={form.hasInsurance} onChange={(v) => update({ hasInsurance: v })} />
        {form.hasInsurance && (
          <div className="mt-2">
            <CheckboxGroup
              options={INSURANCE_TYPES}
              values={form.insuranceTypes || []}
              onChange={(v) => update({ insuranceTypes: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionD2({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you have business loans or lines of credit?</Label>
        <YesNo value={form.hasBusinessLoans} onChange={(v) => update({ hasBusinessLoans: v })} />
        {form.hasBusinessLoans && (
          <div className="mt-2">
            <TextInput
              value={form.loanLenders || ''}
              onChange={(v) => update({ loanLenders: v })}
              placeholder="e.g. SBA loan through Chase, Kabbage LOC $50k"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Do you use a vehicle for business purposes?</Label>
        <YesNo value={form.hasVehicleExpense} onChange={(v) => update({ hasVehicleExpense: v })} />
        {form.hasVehicleExpense && (
          <div className="mt-2">
            <TextInput
              value={form.vehicleBusinessPercent || ''}
              onChange={(v) => update({ vehicleBusinessPercent: v })}
              placeholder="Approximate % used for business (e.g. 70%)"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Do you have business travel expenses (flights, hotels)?</Label>
        <YesNo value={form.hasTravelExpense} onChange={(v) => update({ hasTravelExpense: v })} />
      </div>
      <div>
        <Label>Do you have business meals or entertainment expenses?</Label>
        <YesNo value={form.hasMealsExpense} onChange={(v) => update({ hasMealsExpense: v })} />
        {form.hasMealsExpense && (
          <div className="mt-2">
            <TextInput
              value={form.mealsBusinessPercent || ''}
              onChange={(v) => update({ mealsBusinessPercent: v })}
              placeholder="Approximate % of restaurant/meal charges that are business (e.g. 60%)"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Are there other significant recurring expenses we should know about?</Label>
        <TextArea
          value={form.otherExpenses || ''}
          onChange={(v) => update({ otherExpenses: v })}
          placeholder="e.g. Coworking space $300/mo, trade show fees $5k/year, dues/subscriptions"
        />
      </div>
    </div>
  );
}

function SectionE({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you use the same bank account for business and personal spending?</Label>
        <YesNo value={form.hasMixedAccount} onChange={(v) => update({ hasMixedAccount: v })} />
        <HintText>This is common — we just need to know so we can properly separate them.</HintText>
      </div>
      {form.hasMixedAccount && (
        <div>
          <Label>List vendors or merchants that are almost always personal (never business)</Label>
          <TextArea
            value={form.primaryPersonalVendors || ''}
            onChange={(v) => update({ primaryPersonalVendors: v })}
            placeholder="e.g. Netflix, Spotify, gym membership, grocery stores, school tuition"
          />
          <HintText>We'll exclude these from your P&L automatically.</HintText>
        </div>
      )}
      <div>
        <Label>How do you pay yourself from the business?</Label>
        <Select value={form.ownerPaymentMethod || ''} onChange={(v) => update({ ownerPaymentMethod: v })}>
          <option value="">Select method</option>
          {["Owner's draw / distributions", 'W-2 Salary', 'Both', "I don't pay myself yet"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>
      {form.ownerPaymentMethod && form.ownerPaymentMethod !== "I don't pay myself yet" && (
        <div>
          <Label>Approximate monthly amount you take from the business</Label>
          <TextInput
            value={form.ownerDrawAmount || ''}
            onChange={(v) => update({ ownerDrawAmount: v })}
            placeholder="e.g. $5,000/month or $60,000/year"
          />
        </div>
      )}
    </div>
  );
}

function SectionF({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>What time period does this P&L need to cover?</Label>
        <Select value={form.statementPeriod || ''} onChange={(v) => update({ statementPeriod: v })}>
          <option value="">Select period</option>
          <option value="3">Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months (full year)</option>
          <option value="ytd">Year to date</option>
          <option value="custom">Custom date range</option>
        </Select>
        <HintText>Most online lenders require 3 months. SBA and traditional bank loans often require 12 months.</HintText>
      </div>
      {form.statementPeriod === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <input
              type="date"
              value={form.periodStart || ''}
              onChange={(e) => update({ periodStart: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
            />
          </div>
          <div>
            <Label>End Date</Label>
            <input
              type="date"
              value={form.periodEnd || ''}
              onChange={(e) => update({ periodEnd: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
            />
          </div>
        </div>
      )}
      <div>
        <Label>Accounting basis</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'cash', label: 'Cash Basis', hint: 'Record when money changes hands (most common for small business)' },
            { value: 'accrual', label: 'Accrual Basis', hint: 'Record when earned/incurred (typically for larger businesses)' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ reportingBasis: opt.value })}
              className={`text-left p-3 rounded-lg border-2 transition-all ${
                form.reportingBasis === opt.value
                  ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
              }`}
            >
              <div className="font-semibold text-sm">{opt.label}</div>
              <div className={`text-xs mt-1 ${form.reportingBasis === opt.value ? 'text-blue-100' : 'text-slate-400'}`}>
                {opt.hint}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionG({ form, update }: { form: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Were there any unusually large one-time payments (income or expense) during this period?</Label>
        <YesNo
          value={form.hasLargeSinglePayments}
          onChange={(v) => update({ hasLargeSinglePayments: v })}
        />
        {form.hasLargeSinglePayments && (
          <div className="mt-2">
            <TextArea
              value={form.largeSinglePaymentDescription || ''}
              onChange={(v) => update({ largeSinglePaymentDescription: v })}
              placeholder="e.g. Received $40k insurance settlement in March, bought new equipment for $25k in July"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Does your business have significant seasonal variation in revenue or expenses?</Label>
        <YesNo
          value={form.hasSeasonalVariation}
          onChange={(v) => update({ hasSeasonalVariation: v })}
        />
        {form.hasSeasonalVariation && (
          <div className="mt-2">
            <TextInput
              value={form.seasonalDescription || ''}
              onChange={(v) => update({ seasonalDescription: v })}
              placeholder="e.g. 70% of revenue in Oct–Dec holiday season"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Anything else a lender or accountant should know about your financials?</Label>
        <TextArea
          value={form.additionalContext || ''}
          onChange={(v) => update({ additionalContext: v })}
          placeholder="Optional — any context that would help explain your income or expense patterns"
          rows={4}
        />
      </div>
    </div>
  );
}

// ─── Confirmation messages ─────────────────────────────────────────────────

function getConfirmationMessage(sectionIndex: number, form: FormData): string {
  const processors = (form.paymentProcessors || []).filter((p) => p !== 'Other').join(', ');
  const period = { '3': '3 months', '6': '6 months', '12': '12 months', ytd: 'year to date', custom: 'your custom date range' }[form.statementPeriod || ''] || 'your selected period';

  const messages = [
    `Got it — we'll build your P&L for ${form.businessName || 'your business'}, a ${form.entityType || 'business'} in ${form.industry || 'your industry'}.`,
    processors
      ? `We'll look for deposits from ${processors} as your revenue sources.`
      : "We'll identify your revenue from the transaction descriptions.",
    form.isServiceBusiness
      ? "Since you're service-based, we'll skip the Cost of Goods section — your gross profit equals your revenue."
      : `We'll flag purchases from your vendors as cost of goods sold.`,
    `Software subscriptions and operating services will be classified as business expenses automatically.`,
    `${form.hasVehicleExpense ? `Vehicle expenses will be prorated at ${form.vehicleBusinessPercent || 'your stated'} business use. ` : ''}Day-to-day operational expenses locked in.`,
    form.hasMixedAccount
      ? `Mixed account noted — we'll exclude your personal vendors and handle owner draws separately.`
      : `Dedicated business account confirmed — classification will be cleaner.`,
    `P&L will cover ${period}, reported on a ${form.reportingBasis === 'accrual' ? 'accrual' : 'cash'} basis.`,
    `Thanks — any unusual items will be called out in the Notes & Assumptions section of your report.`,
  ];
  return messages[sectionIndex] || 'Section complete.';
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [currentSection, setCurrentSection] = useState(0);
  const [form, setForm] = useState<FormData>({
    reportingBasis: 'cash',
    workerTypes: [],
    paymentProcessors: [],
    advertisingPlatforms: [],
    insuranceTypes: [],
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Compute visible sections (skip COGS if service business)
  const visibleSections = SECTIONS.filter((s, idx) => {
    if (idx === 2 && form.isServiceBusiness) return false; // Skip COGS
    return true;
  });
  const totalSections = visibleSections.length;
  const progressPct = Math.round(((currentSection + 1) / totalSections) * 100);

  // Load existing session
  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    getQuestionnaireData(sid).then((data) => {
      if (data) {
        setForm(data);
        if (data.currentSection) setCurrentSection(data.currentSection);
      }
    });
  }, []);

  const update = useCallback((patch: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setShowConfirmation(false);
  }, []);

  const handleNext = async () => {
    setIsSaving(true);
    // Save with a timeout — don't let a DB failure block navigation
    try {
      await Promise.race([
        saveQuestionnaireProgress(sessionId, {
          ...form,
          currentSection: currentSection + 1,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    } catch {
      // Save failed or timed out — continue anyway, data is in React state
      console.warn('Questionnaire save failed, continuing without persistence');
    }
    setIsSaving(false);
    setShowConfirmation(true);
    setTimeout(() => {
      setShowConfirmation(false);
      if (currentSection + 1 >= totalSections) {
        router.push('/upload');
      } else {
        setCurrentSection((s) => s + 1);
      }
    }, 1800);
  };

  const handleBack = () => {
    if (currentSection === 0) {
      router.push('/');
    } else {
      setCurrentSection((s) => s - 1);
      setShowConfirmation(false);
    }
  };

  const currentSectionDef = visibleSections[currentSection];

  // Map section id to component
  const sectionComponents: Record<string, React.ReactNode> = {
    A: <SectionA form={form} update={update} />,
    B: <SectionB form={form} update={update} />,
    C: <SectionC form={form} update={update} />,
    D1: <SectionD1 form={form} update={update} />,
    D2: <SectionD2 form={form} update={update} />,
    E: <SectionE form={form} update={update} />,
    F: <SectionF form={form} update={update} />,
    G: <SectionG form={form} update={update} />,
  };

  const isLastSection = currentSection === totalSections - 1;

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
        <span className="text-xs text-slate-500">
          Section {currentSection + 1} of {totalSections}
        </span>
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-200">
        <div
          className="h-1 bg-[#C9A84C] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Section header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">
                Section {currentSection + 1}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#1B3A5C]">{currentSectionDef?.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{currentSectionDef?.description}</p>
          </div>

          {/* Section form */}
          {!showConfirmation ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              {currentSectionDef && sectionComponents[currentSectionDef.id]}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ConfirmationCard message={getConfirmationMessage(currentSection, form)} />
              <div className="flex justify-center mt-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {!showConfirmation && (
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-slate-300 transition-all"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={isSaving}
                className="flex-2 flex-[2] py-3 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm hover:bg-[#152e4a] transition-all disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : isLastSection ? 'Upload Statements →' : 'Continue →'}
              </button>
            </div>
          )}

          {/* Section dots */}
          <div className="flex justify-center gap-2 mt-6">
            {visibleSections.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentSection
                    ? 'bg-[#1B3A5C] w-4'
                    : idx < currentSection
                    ? 'bg-[#C9A84C]'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
