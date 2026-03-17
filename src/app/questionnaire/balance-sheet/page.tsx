'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOrCreateSessionId,
  getQuestionnaireData,
  getProductType,
  type QuestionnaireData,
  type ProductType,
} from '@/lib/db';

// ─── Balance Sheet data shape ─────────────────────────────────────────────────

export interface BalanceSheetData {
  statementDate: string;
  entityType: string;
  businessName: string;
  bankAccounts: { bankName: string; accountType: string; balance: string }[];
  hasCashEquivalents: boolean;
  cashEquivalentsDesc: string;
  hasPrepaidExpenses: boolean;
  prepaidExpensesDesc: string;
  prepaidExpensesAmount: string;
  hasAccountsReceivable: boolean;
  arBalance: string;
  arAvgDaysOutstanding: string;
  hasUncollectible: boolean;
  hasInventory: boolean;
  inventoryValue: string;
  inventoryValuationMethod: string;
  hasEquipment: boolean;
  equipmentItems: { description: string; purchaseYear: string; originalCost: string; depreciationMethod: string }[];
  hasVehicles: boolean;
  vehicleItems: { description: string; purchaseYear: string; originalCost: string }[];
  hasRealEstate: boolean;
  realEstateDesc: string;
  realEstateValue: string;
  hasIntangibles: boolean;
  intangiblesDesc: string;
  intangiblesValue: string;
  hasSecurityDeposits: boolean;
  securityDepositsTotal: string;
  hasLongTermInvestments: boolean;
  longTermInvestmentsDesc: string;
  hasAccountsPayable: boolean;
  apBalance: string;
  hasShortTermDebt: boolean;
  shortTermDebtDesc: string;
  shortTermDebtBalance: string;
  hasAccruedLiabilities: boolean;
  accruedWages: string;
  accruedTaxes: string;
  hasDeferredRevenue: boolean;
  deferredRevenueAmount: string;
  deferredRevenueDesc: string;
  hasLongTermLoans: boolean;
  loans: { lender: string; originalAmount: string; currentBalance: string; interestRate: string; maturityDate: string }[];
  hasSBALoan: boolean;
  sbaBalance: string;
  sbaForgivenessStatus: string;
  hasLeaseObligations: boolean;
  leases: { description: string; monthlyPayment: string; remainingMonths: string; leaseType: string }[];
  priorYearRetainedEarnings: string;
  ownerContributionsThisYear: string;
  ownerDistributionsThisYear: string;
  commonStockValue: string;
  additionalPaidInCapital: string;
  partnerCapitalAccounts: { partnerName: string; ownershipPct: string; capitalBalance: string }[];
  memberEquityTotal: string;
}

type BSForm = Partial<BalanceSheetData>;

// ─── Section definitions ──────────────────────────────────────────────────────

const BS_SECTIONS = [
  { id: 'S1', title: 'Statement Date',          description: 'When do you need this balance sheet as of?' },
  { id: 'S2', title: 'Cash & Short-term Assets', description: 'Your most liquid assets' },
  { id: 'S3', title: 'Receivables & Inventory',  description: 'Money owed to you and goods on hand' },
  { id: 'S4', title: 'Property & Equipment',     description: 'Long-term physical assets your business owns' },
  { id: 'S5', title: 'Other Assets',             description: 'Deposits, intangibles, and investments' },
  { id: 'S6', title: 'Current Liabilities',      description: 'What you owe within the next 12 months' },
  { id: 'S7', title: 'Long-term Liabilities',    description: 'Loans, mortgages, and lease obligations' },
  { id: 'S8', title: "Owner's Equity",           description: 'Your stake in the business' },
];

// ─── Helper components ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700 mb-1">{children}</label>;
}

function HintText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 mt-1">{children}</p>;
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:border-transparent"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
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

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] bg-white"
    >
      {children}
    </select>
  );
}

function YesNo({ value, onChange }: {
  value: boolean | undefined; onChange: (v: boolean) => void;
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

function ConfirmationCard({ message }: { message: string }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-start">
      <span className="text-emerald-500 text-lg">✓</span>
      <p className="text-sm text-emerald-800">{message}</p>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-500 mb-1">{children}</label>;
}

// Generic repeatable row editor
function RepeatableRows<T extends Record<string, string>>({
  rows, onChange, emptyRow, fields, addLabel = '+ Add another',
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  emptyRow: T;
  fields: { key: keyof T; label: string; placeholder?: string; fullWidth?: boolean }[];
  addLabel?: string;
}) {
  const safeRows = rows.length > 0 ? rows : [{ ...emptyRow }];
  const update = (i: number, key: keyof T, val: string) => {
    onChange(safeRows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };
  const addRow = () => onChange([...safeRows, { ...emptyRow }]);
  const removeRow = (i: number) => { if (safeRows.length > 1) onChange(safeRows.filter((_, idx) => idx !== i)); };

  return (
    <div className="space-y-3">
      {safeRows.map((row, i) => (
        <div key={i} className="bg-slate-50 rounded-xl p-4 relative">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={String(f.key)} className={f.fullWidth ? 'col-span-2' : ''}>
                <SubLabel>{f.label}</SubLabel>
                <TextInput
                  value={String(row[f.key] || '')}
                  onChange={(v) => update(i, f.key, v)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          {safeRows.length > 1 && (
            <button type="button" onClick={() => removeRow(i)}
              className="absolute top-3 right-3 text-slate-400 hover:text-red-400 text-sm">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow}
        className="text-sm text-[#1B3A5C] font-semibold hover:text-[#C9A84C] transition-colors">
        {addLabel}
      </button>
    </div>
  );
}

// ─── SECTION 1 ────────────────────────────────────────────────────────────────

function Section1({ form, update, prefilled }: {
  form: BSForm; update: (d: Partial<BSForm>) => void;
  prefilled: { businessName?: string; entityType?: string };
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Business name</Label>
        <TextInput
          value={form.businessName || prefilled.businessName || ''}
          onChange={(v) => update({ businessName: v })}
          placeholder="e.g. Magnolia Supply LLC"
        />
        {prefilled.businessName && <HintText>Pre-filled from your P&L questionnaire — edit if needed.</HintText>}
      </div>
      <div>
        <Label>Balance sheet as of (statement date)</Label>
        <TextInput
          type="date"
          value={form.statementDate || ''}
          onChange={(v) => update({ statementDate: v })}
        />
        <HintText>Most lenders want the last day of the most recently completed month or fiscal year end.</HintText>
      </div>
      <div>
        <Label>Business entity type</Label>
        <Select value={form.entityType || prefilled.entityType || ''} onChange={(v) => update({ entityType: v })}>
          <option value="">Select entity type</option>
          {['Sole Proprietor / 1099', 'Single-Member LLC', 'Multi-Member LLC', 'S-Corp', 'C-Corp', 'Partnership']
            .map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
        <HintText>This determines how the equity section is structured on your balance sheet.</HintText>
      </div>
    </div>
  );
}

// ─── SECTION 2 ────────────────────────────────────────────────────────────────

const EMPTY_ACCOUNT = { bankName: '', accountType: '', balance: '' };

function Section2({ form, update }: { form: BSForm; update: (d: Partial<BSForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Bank accounts (list all business accounts)</Label>
        <HintText>Include checking, savings, money market, and any other accounts the business holds.</HintText>
        <div className="mt-2">
          <RepeatableRows
            rows={(form.bankAccounts?.length ? form.bankAccounts : [{ ...EMPTY_ACCOUNT }]) as typeof EMPTY_ACCOUNT[]}
            onChange={(rows) => update({ bankAccounts: rows })}
            emptyRow={EMPTY_ACCOUNT}
            fields={[
              { key: 'bankName', label: 'Bank name', placeholder: 'e.g. Chase, Bank of America' },
              { key: 'accountType', label: 'Account type', placeholder: 'Checking / Savings / Money Market' },
              { key: 'balance', label: 'Approximate balance', placeholder: 'e.g. $18,500', fullWidth: true },
            ]}
            addLabel="+ Add another account"
          />
        </div>
      </div>
      <div>
        <Label>Do you hold any cash equivalents? (CDs, T-bills, money market funds)</Label>
        <YesNo value={form.hasCashEquivalents} onChange={(v) => update({ hasCashEquivalents: v })} />
        {form.hasCashEquivalents && (
          <div className="mt-2">
            <TextInput value={form.cashEquivalentsDesc || ''} onChange={(v) => update({ cashEquivalentsDesc: v })}
              placeholder="e.g. 90-day CD at Wells Fargo $25,000, Treasury bills $10,000" />
          </div>
        )}
      </div>
      <div>
        <Label>Do you have any prepaid expenses? (insurance paid ahead, rent deposits, annual subscriptions)</Label>
        <YesNo value={form.hasPrepaidExpenses} onChange={(v) => update({ hasPrepaidExpenses: v })} />
        {form.hasPrepaidExpenses && (
          <div className="mt-2 space-y-2">
            <TextInput value={form.prepaidExpensesDesc || ''} onChange={(v) => update({ prepaidExpensesDesc: v })}
              placeholder="e.g. 6-month insurance premium paid Jan 1, annual software licenses" />
            <TextInput value={form.prepaidExpensesAmount || ''} onChange={(v) => update({ prepaidExpensesAmount: v })}
              placeholder="Total estimated prepaid amount (e.g. $4,200)" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION 3 ────────────────────────────────────────────────────────────────

function Section3({ form, update }: { form: BSForm; update: (d: Partial<BSForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Does your business have money owed by customers? (Accounts Receivable)</Label>
        <YesNo value={form.hasAccountsReceivable} onChange={(v) => update({ hasAccountsReceivable: v })} />
        {form.hasAccountsReceivable && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SubLabel>Total AR balance</SubLabel>
                <TextInput value={form.arBalance || ''} onChange={(v) => update({ arBalance: v })} placeholder="e.g. $42,000" />
              </div>
              <div>
                <SubLabel>Average days outstanding</SubLabel>
                <Select value={form.arAvgDaysOutstanding || ''} onChange={(v) => update({ arAvgDaysOutstanding: v })}>
                  <option value="">Select range</option>
                  <option value="0-30">0–30 days (current)</option>
                  <option value="31-60">31–60 days</option>
                  <option value="61-90">61–90 days</option>
                  <option value="90+">90+ days</option>
                  <option value="mixed">Mixed — I have an aging report</option>
                </Select>
              </div>
            </div>
            <div>
              <SubLabel>Are any accounts likely uncollectible?</SubLabel>
              <YesNo value={form.hasUncollectible} onChange={(v) => update({ hasUncollectible: v })} />
              <HintText>If yes, we'll create an allowance for doubtful accounts — standard GAAP practice.</HintText>
            </div>
          </div>
        )}
      </div>
      <div>
        <Label>Do you carry inventory? (physical goods held for sale or raw materials)</Label>
        <YesNo value={form.hasInventory} onChange={(v) => update({ hasInventory: v })} />
        {form.hasInventory && (
          <div className="mt-3 space-y-3">
            <div>
              <SubLabel>Inventory value at statement date</SubLabel>
              <TextInput value={form.inventoryValue || ''} onChange={(v) => update({ inventoryValue: v })}
                placeholder="e.g. $85,000 — use most recent count or estimate" />
            </div>
            <div>
              <SubLabel>Inventory valuation method</SubLabel>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'fifo', label: 'FIFO', hint: 'First in, first out' },
                  { val: 'lifo', label: 'LIFO', hint: 'Last in, first out' },
                  { val: 'weighted-avg', label: 'Wtd Avg', hint: 'Average cost' },
                ].map((opt) => (
                  <button key={opt.val} type="button" onClick={() => update({ inventoryValuationMethod: opt.val })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      form.inventoryValuationMethod === opt.val
                        ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
                    }`}>
                    <div className="font-bold text-sm">{opt.label}</div>
                    <div className={`text-xs mt-0.5 ${form.inventoryValuationMethod === opt.val ? 'text-blue-100' : 'text-slate-400'}`}>{opt.hint}</div>
                  </button>
                ))}
              </div>
              <HintText>Not sure? Most small businesses use FIFO.</HintText>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION 4 ────────────────────────────────────────────────────────────────

const EMPTY_EQUIP  = { description: '', purchaseYear: '', originalCost: '', depreciationMethod: '' };
const EMPTY_VEH    = { description: '', purchaseYear: '', originalCost: '' };

function Section4({ form, update }: { form: BSForm; update: (d: Partial<BSForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Does the business own equipment, machinery, or tools worth more than $1,000?</Label>
        <YesNo value={form.hasEquipment} onChange={(v) => update({ hasEquipment: v })} />
        {form.hasEquipment && (
          <div className="mt-3">
            <HintText>List major items — computers, machinery, POS systems, restaurant equipment, etc.</HintText>
            <div className="mt-2">
              <RepeatableRows
                rows={(form.equipmentItems?.length ? form.equipmentItems : [{ ...EMPTY_EQUIP }]) as typeof EMPTY_EQUIP[]}
                onChange={(rows) => update({ equipmentItems: rows })}
                emptyRow={EMPTY_EQUIP}
                fields={[
                  { key: 'description', label: 'Description', placeholder: 'e.g. Commercial oven, MacBook Pro' },
                  { key: 'purchaseYear', label: 'Year purchased', placeholder: 'e.g. 2022' },
                  { key: 'originalCost', label: 'Original cost', placeholder: 'e.g. $8,500' },
                  { key: 'depreciationMethod', label: 'Depreciation method', placeholder: 'Straight-line / MACRS / Section 179', fullWidth: true },
                ]}
                addLabel="+ Add equipment item"
              />
            </div>
          </div>
        )}
      </div>
      <div>
        <Label>Do you own any vehicles used for business?</Label>
        <YesNo value={form.hasVehicles} onChange={(v) => update({ hasVehicles: v })} />
        {form.hasVehicles && (
          <div className="mt-3">
            <RepeatableRows
              rows={(form.vehicleItems?.length ? form.vehicleItems : [{ ...EMPTY_VEH }]) as typeof EMPTY_VEH[]}
              onChange={(rows) => update({ vehicleItems: rows })}
              emptyRow={EMPTY_VEH}
              fields={[
                { key: 'description', label: 'Vehicle', placeholder: 'e.g. 2021 Ford F-150' },
                { key: 'purchaseYear', label: 'Year purchased', placeholder: 'e.g. 2021' },
                { key: 'originalCost', label: 'Purchase price', placeholder: 'e.g. $38,000', fullWidth: true },
              ]}
              addLabel="+ Add vehicle"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Does the business own real estate? (building, land, commercial property)</Label>
        <YesNo value={form.hasRealEstate} onChange={(v) => update({ hasRealEstate: v })} />
        {form.hasRealEstate && (
          <div className="mt-3 space-y-2">
            <TextInput value={form.realEstateDesc || ''} onChange={(v) => update({ realEstateDesc: v })}
              placeholder="e.g. Commercial building at 123 Main St — owned outright" />
            <TextInput value={form.realEstateValue || ''} onChange={(v) => update({ realEstateValue: v })}
              placeholder="Original purchase price (e.g. $450,000) — not current market value" />
            <HintText>GAAP historical cost principle: we record what you paid, not current appraised value.</HintText>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION 5 ────────────────────────────────────────────────────────────────

function Section5({ form, update }: { form: BSForm; update: (d: Partial<BSForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you have intangible assets? (patents, trademarks, goodwill from an acquisition)</Label>
        <YesNo value={form.hasIntangibles} onChange={(v) => update({ hasIntangibles: v })} />
        {form.hasIntangibles && (
          <div className="mt-3 space-y-2">
            <TextInput value={form.intangiblesDesc || ''} onChange={(v) => update({ intangiblesDesc: v })}
              placeholder="e.g. Trademark registration, goodwill from 2022 acquisition of ABC Co." />
            <TextInput value={form.intangiblesValue || ''} onChange={(v) => update({ intangiblesValue: v })}
              placeholder="Recorded value at cost (e.g. $50,000)" />
          </div>
        )}
      </div>
      <div>
        <Label>Do you have security deposits paid? (lease deposits, utility deposits)</Label>
        <YesNo value={form.hasSecurityDeposits} onChange={(v) => update({ hasSecurityDeposits: v })} />
        {form.hasSecurityDeposits && (
          <div className="mt-2">
            <TextInput value={form.securityDepositsTotal || ''} onChange={(v) => update({ securityDepositsTotal: v })}
              placeholder="Total of all deposits paid (e.g. $6,000 — 2 months rent deposit)" />
          </div>
        )}
      </div>
      <div>
        <Label>Do you hold any long-term investments in other businesses or securities?</Label>
        <YesNo value={form.hasLongTermInvestments} onChange={(v) => update({ hasLongTermInvestments: v })} />
        {form.hasLongTermInvestments && (
          <div className="mt-2">
            <TextArea value={form.longTermInvestmentsDesc || ''} onChange={(v) => update({ longTermInvestmentsDesc: v })}
              placeholder="e.g. 20% ownership stake in XYZ Partners LLC, $15k in municipal bonds" />
            <HintText>Stakes of 20%+ generally use the equity method. Minority stakes recorded at cost.</HintText>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION 6 ────────────────────────────────────────────────────────────────

function Section6({ form, update }: { form: BSForm; update: (d: Partial<BSForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you owe money to vendors or suppliers? (Accounts Payable)</Label>
        <YesNo value={form.hasAccountsPayable} onChange={(v) => update({ hasAccountsPayable: v })} />
        {form.hasAccountsPayable && (
          <div className="mt-2">
            <TextInput value={form.apBalance || ''} onChange={(v) => update({ apBalance: v })}
              placeholder="Total AP balance (e.g. $12,400)" />
            <HintText>Money owed for goods/services already received but not yet paid.</HintText>
          </div>
        )}
      </div>
      <div>
        <Label>Do you have any short-term debt or credit lines due within 12 months?</Label>
        <YesNo value={form.hasShortTermDebt} onChange={(v) => update({ hasShortTermDebt: v })} />
        {form.hasShortTermDebt && (
          <div className="mt-3 space-y-2">
            <TextInput value={form.shortTermDebtDesc || ''} onChange={(v) => update({ shortTermDebtDesc: v })}
              placeholder="e.g. Business line of credit (Chase), short-term loan (Kabbage)" />
            <TextInput value={form.shortTermDebtBalance || ''} onChange={(v) => update({ shortTermDebtBalance: v })}
              placeholder="Balance due within 12 months (e.g. $25,000)" />
          </div>
        )}
      </div>
      <div>
        <Label>Do you have accrued liabilities? (unpaid wages, taxes, or benefits as of statement date)</Label>
        <YesNo value={form.hasAccruedLiabilities} onChange={(v) => update({ hasAccruedLiabilities: v })} />
        {form.hasAccruedLiabilities && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SubLabel>Accrued wages & payroll</SubLabel>
                <TextInput value={form.accruedWages || ''} onChange={(v) => update({ accruedWages: v })} placeholder="e.g. $8,000" />
              </div>
              <div>
                <SubLabel>Accrued taxes owed</SubLabel>
                <TextInput value={form.accruedTaxes || ''} onChange={(v) => update({ accruedTaxes: v })} placeholder="e.g. $3,200" />
              </div>
            </div>
            <HintText>Expenses incurred but not yet paid as of the statement date.</HintText>
          </div>
        )}
      </div>
      <div>
        <Label>Have customers paid you for work or goods not yet delivered? (Deferred Revenue)</Label>
        <YesNo value={form.hasDeferredRevenue} onChange={(v) => update({ hasDeferredRevenue: v })} />
        {form.hasDeferredRevenue && (
          <div className="mt-3 space-y-2">
            <TextInput value={form.deferredRevenueDesc || ''} onChange={(v) => update({ deferredRevenueDesc: v })}
              placeholder="e.g. Annual subscriptions, prepaid retainers, gift cards outstanding" />
            <TextInput value={form.deferredRevenueAmount || ''} onChange={(v) => update({ deferredRevenueAmount: v })}
              placeholder="Total amount not yet earned (e.g. $18,000)" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION 7 ────────────────────────────────────────────────────────────────

const EMPTY_LOAN  = { lender: '', originalAmount: '', currentBalance: '', interestRate: '', maturityDate: '' };
const EMPTY_LEASE = { description: '', monthlyPayment: '', remainingMonths: '', leaseType: '' };

function Section7({ form, update }: { form: BSForm; update: (d: Partial<BSForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you have any business loans or mortgages with more than 12 months remaining?</Label>
        <YesNo value={form.hasLongTermLoans} onChange={(v) => update({ hasLongTermLoans: v })} />
        {form.hasLongTermLoans && (
          <div className="mt-3">
            <RepeatableRows
              rows={(form.loans?.length ? form.loans : [{ ...EMPTY_LOAN }]) as typeof EMPTY_LOAN[]}
              onChange={(rows) => update({ loans: rows })}
              emptyRow={EMPTY_LOAN}
              fields={[
                { key: 'lender', label: 'Lender', placeholder: 'e.g. Chase Bank, SBA' },
                { key: 'originalAmount', label: 'Original amount', placeholder: 'e.g. $200,000' },
                { key: 'currentBalance', label: 'Current balance', placeholder: 'e.g. $148,000' },
                { key: 'interestRate', label: 'Interest rate', placeholder: 'e.g. 6.5%' },
                { key: 'maturityDate', label: 'Maturity date', placeholder: 'e.g. Dec 2031', fullWidth: true },
              ]}
              addLabel="+ Add another loan"
            />
          </div>
        )}
      </div>
      <div>
        <Label>Do you have an SBA loan?</Label>
        <YesNo value={form.hasSBALoan} onChange={(v) => update({ hasSBALoan: v })} />
        {form.hasSBALoan && (
          <div className="mt-3 space-y-2">
            <TextInput value={form.sbaBalance || ''} onChange={(v) => update({ sbaBalance: v })}
              placeholder="Current SBA loan balance (e.g. $95,000)" />
            <Select value={form.sbaForgivenessStatus || ''} onChange={(v) => update({ sbaForgivenessStatus: v })}>
              <option value="">PPP forgiveness status (if applicable)</option>
              <option value="not-ppp">Not a PPP loan</option>
              <option value="fully-forgiven">PPP — fully forgiven</option>
              <option value="partially-forgiven">PPP — partially forgiven</option>
              <option value="not-forgiven">PPP — not forgiven / still owed</option>
              <option value="pending">PPP — forgiveness pending</option>
            </Select>
          </div>
        )}
      </div>
      <div>
        <Label>Do you have any operating or finance leases? (equipment, vehicles, office space over 12 months)</Label>
        <YesNo value={form.hasLeaseObligations} onChange={(v) => update({ hasLeaseObligations: v })} />
        {form.hasLeaseObligations && (
          <div className="mt-3">
            <HintText>Under ASC 842, leases longer than 12 months appear on the balance sheet as a Right-of-Use asset and lease liability.</HintText>
            <div className="mt-2">
              <RepeatableRows
                rows={(form.leases?.length ? form.leases : [{ ...EMPTY_LEASE }]) as typeof EMPTY_LEASE[]}
                onChange={(rows) => update({ leases: rows })}
                emptyRow={EMPTY_LEASE}
                fields={[
                  { key: 'description', label: 'What is leased', placeholder: 'e.g. Office space, delivery van' },
                  { key: 'monthlyPayment', label: 'Monthly payment', placeholder: 'e.g. $2,400' },
                  { key: 'remainingMonths', label: 'Months remaining', placeholder: 'e.g. 36' },
                  { key: 'leaseType', label: 'Lease type', placeholder: 'Operating / Finance', fullWidth: true },
                ]}
                addLabel="+ Add another lease"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECTION 8 ────────────────────────────────────────────────────────────────

const EMPTY_PARTNER = { partnerName: '', ownershipPct: '', capitalBalance: '' };

function Section8({ form, update, entityType }: {
  form: BSForm; update: (d: Partial<BSForm>) => void; entityType: string;
}) {
  const isSoleProp       = entityType.includes('Sole Proprietor');
  const isMultiMemberLLC = entityType === 'Multi-Member LLC';
  const isSingleLLC      = entityType === 'Single-Member LLC';
  const isPartnership    = entityType === 'Partnership';
  const isCorp           = entityType.includes('Corp');

  const capitalLabel = isSoleProp
    ? "Owner's capital at the start of this period"
    : isPartnership || isMultiMemberLLC
    ? 'Total partner / member capital at the start of this period'
    : 'Retained earnings at the start of this period';

  const taxFormHint = isCorp
    ? 'Form 1120 / 1120-S Schedule L'
    : isPartnership
    ? 'Form 1065 Schedule L'
    : 'Schedule C or prior year balance sheet';

  return (
    <div className="space-y-5">
      <div>
        <Label>{capitalLabel}</Label>
        <TextInput value={form.priorYearRetainedEarnings || ''} onChange={(v) => update({ priorYearRetainedEarnings: v })}
          placeholder="From prior year balance sheet or tax return (e.g. $84,000) — enter 0 if first year" />
        <HintText>Find this on your prior year balance sheet or tax return: {taxFormHint}.</HintText>
      </div>

      <div>
        <Label>Additional capital contributed this period</Label>
        <TextInput value={form.ownerContributionsThisYear || ''} onChange={(v) => update({ ownerContributionsThisYear: v })}
          placeholder="Money you personally put INTO the business this year (e.g. $15,000 — enter 0 if none)" />
      </div>

      <div>
        <Label>Distributions or draws taken this period</Label>
        <TextInput value={form.ownerDistributionsThisYear || ''} onChange={(v) => update({ ownerDistributionsThisYear: v })}
          placeholder="Money taken OUT of the business — owner draws, S-Corp distributions (e.g. $60,000)" />
        <HintText>Includes owner draws, distributions, and any S-Corp salary paid to owners.</HintText>
      </div>

      {isCorp && (
        <>
          <div>
            <Label>Common stock / paid-in capital</Label>
            <TextInput value={form.commonStockValue || ''} onChange={(v) => update({ commonStockValue: v })}
              placeholder="Par value of issued stock (e.g. $1,000 — often nominal for small corps)" />
          </div>
          <div>
            <Label>Additional paid-in capital (APIC)</Label>
            <TextInput value={form.additionalPaidInCapital || ''} onChange={(v) => update({ additionalPaidInCapital: v })}
              placeholder="Amount received above par value from stock issuance (e.g. $25,000)" />
          </div>
        </>
      )}

      {(isMultiMemberLLC || isPartnership) && (
        <div>
          <Label>Partner / Member capital accounts</Label>
          <HintText>List each partner or member with their ownership percentage and capital balance.</HintText>
          <div className="mt-2">
            <RepeatableRows
              rows={(form.partnerCapitalAccounts?.length ? form.partnerCapitalAccounts : [{ ...EMPTY_PARTNER }]) as typeof EMPTY_PARTNER[]}
              onChange={(rows) => update({ partnerCapitalAccounts: rows })}
              emptyRow={EMPTY_PARTNER}
              fields={[
                { key: 'partnerName', label: 'Partner / Member name', placeholder: 'e.g. Jane Smith' },
                { key: 'ownershipPct', label: 'Ownership %', placeholder: 'e.g. 60%' },
                { key: 'capitalBalance', label: 'Capital balance', placeholder: 'e.g. $48,000', fullWidth: true },
              ]}
              addLabel="+ Add partner / member"
            />
          </div>
        </div>
      )}

      {isSingleLLC && (
        <div>
          <Label>Member equity total (optional)</Label>
          <TextInput value={form.memberEquityTotal || ''} onChange={(v) => update({ memberEquityTotal: v })}
            placeholder="Your total equity in the LLC (e.g. $112,000) — leave blank to calculate automatically" />
          <HintText>If blank, we'll calculate this as: Total Assets − Total Liabilities.</HintText>
        </div>
      )}
    </div>
  );
}

// ─── Confirmation messages ────────────────────────────────────────────────────

function getBSConfirmation(idx: number, form: BSForm): string {
  const accounts = form.bankAccounts?.filter((a) => a.bankName).length ?? 0;
  const msgs = [
    `Balance sheet for ${form.businessName || 'your business'} as of ${form.statementDate || '[date]'}. Entity type set to ${form.entityType || 'your type'}.`,
    `${accounts > 0 ? `${accounts} bank account${accounts > 1 ? 's' : ''} recorded.` : 'Cash accounts captured.'} ${form.hasPrepaidExpenses ? 'Prepaid expenses will appear under current assets.' : ''}`,
    `${form.hasAccountsReceivable ? `AR balance of ${form.arBalance || '?'} noted.` : 'No receivables.'} ${form.hasInventory ? `Inventory at ${form.inventoryValue || '?'} using ${(form.inventoryValuationMethod || '').toUpperCase() || 'selected'} method.` : 'No inventory.'}`,
    `Fixed assets captured — ${[form.hasEquipment && 'equipment', form.hasVehicles && 'vehicles', form.hasRealEstate && 'real estate'].filter(Boolean).join(', ') || 'none noted'}.`,
    `${form.hasIntangibles ? 'Intangibles recorded.' : 'No intangibles.'} ${form.hasSecurityDeposits ? `Security deposits of ${form.securityDepositsTotal || '?'} added to non-current assets.` : ''}`,
    `Current liabilities — ${[form.hasAccountsPayable && 'AP', form.hasShortTermDebt && 'short-term debt', form.hasAccruedLiabilities && 'accruals', form.hasDeferredRevenue && 'deferred revenue'].filter(Boolean).join(', ') || 'none noted'}.`,
    `Long-term liabilities — ${[form.hasLongTermLoans && 'term loans', form.hasSBALoan && 'SBA loan', form.hasLeaseObligations && 'lease obligations'].filter(Boolean).join(', ') || 'none noted'}.`,
    `Equity section complete. We have everything needed to balance your sheet — heading to checkout.`,
  ];
  return msgs[idx] || 'Section complete.';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BalanceSheetQuestionnairePage() {
  const router = useRouter();
  const [productType, setProductType] = useState<ProductType>('balance-sheet');
  const [currentSection, setCurrentSection] = useState(0);
  const [form, setForm] = useState<BSForm>({
    bankAccounts: [{ bankName: '', accountType: '', balance: '' }],
    equipmentItems: [], vehicleItems: [], loans: [], leases: [], partnerCapitalAccounts: [],
  });
  const [prefilled, setPrefilled] = useState<{ businessName?: string; entityType?: string }>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalSections = BS_SECTIONS.length;
  const progressPct = Math.round(((currentSection + 1) / totalSections) * 100);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    const pt = getProductType();
    setProductType(pt);

    // Restore saved BS progress
    try {
      const saved = sessionStorage.getItem('ff_bs_data');
      if (saved) {
        const parsed = JSON.parse(saved) as BSForm & { currentBSSection?: number };
        const { currentBSSection, ...rest } = parsed;
        setForm((prev) => ({ ...prev, ...rest }));
        if (typeof currentBSSection === 'number') setCurrentSection(currentBSSection);
      }
    } catch { /* ignore */ }

    // Pre-fill business info from P&L questionnaire for bundle users
    getQuestionnaireData(sid).then((data?: Partial<QuestionnaireData>) => {
      if (data) {
        setPrefilled({ businessName: data.businessName, entityType: data.entityType });
        setForm((prev) => ({
          ...prev,
          businessName: prev.businessName || data.businessName || '',
          entityType: prev.entityType || data.entityType || '',
        }));
      }
    });
  }, []);

  const update = useCallback((patch: Partial<BSForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setShowConfirmation(false);
  }, []);

  const handleNext = async () => {
    setIsSaving(true);
    try {
      sessionStorage.setItem('ff_bs_data', JSON.stringify({ ...form, currentBSSection: currentSection + 1 }));
    } catch { /* ignore */ }
    setIsSaving(false);
    setShowConfirmation(true);

    setTimeout(() => {
      setShowConfirmation(false);
      if (currentSection + 1 >= totalSections) {
        router.push('/checkout');
      } else {
        setCurrentSection((s) => s + 1);
      }
    }, 1800);
  };

  const handleBack = () => {
    if (currentSection === 0) {
      router.push(productType === 'bundle' ? '/upload' : '/');
    } else {
      setCurrentSection((s) => s - 1);
      setShowConfirmation(false);
    }
  };

  const currentSectionDef = BS_SECTIONS[currentSection];
  const entityType = form.entityType || prefilled.entityType || '';
  const isLastSection = currentSection === totalSections - 1;

  const sectionComponents: Record<string, React.ReactNode> = {
    S1: <Section1 form={form} update={update} prefilled={prefilled} />,
    S2: <Section2 form={form} update={update} />,
    S3: <Section3 form={form} update={update} />,
    S4: <Section4 form={form} update={update} />,
    S5: <Section5 form={form} update={update} />,
    S6: <Section6 form={form} update={update} />,
    S7: <Section7 form={form} update={update} />,
    S8: <Section8 form={form} update={update} entityType={entityType} />,
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
        <span className="text-xs text-slate-500">
          Balance Sheet · {currentSection + 1} of {totalSections}
        </span>
      </header>

      {/* Progress */}
      <div className="w-full h-1 bg-slate-200">
        <div className="h-1 bg-[#C9A84C] transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Bundle phase banner */}
      {productType === 'bundle' && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 text-center text-xs font-medium text-amber-700">
          Full Financial Package · P&L complete ✓ — now completing your balance sheet
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* Section header */}
          <div className="mb-6">
            <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">
              Balance Sheet · Section {currentSection + 1}
            </span>
            <h1 className="text-xl font-bold text-[#1B3A5C] mt-1">{currentSectionDef?.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{currentSectionDef?.description}</p>
          </div>

          {/* Form / confirmation */}
          {!showConfirmation ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              {currentSectionDef && sectionComponents[currentSectionDef.id]}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ConfirmationCard message={getBSConfirmation(currentSection, form)} />
              <div className="flex justify-center mt-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 bg-[#C9A84C] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {!showConfirmation && (
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={handleBack}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-slate-300 transition-all">
                ← Back
              </button>
              <button type="button" onClick={handleNext} disabled={isSaving}
                className="flex-[2] py-3 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm hover:bg-[#152e4a] transition-all disabled:opacity-60">
                {isSaving ? 'Saving...' : isLastSection ? 'Continue to Checkout →' : 'Continue →'}
              </button>
            </div>
          )}

          {/* Section dots */}
          <div className="flex justify-center gap-2 mt-6">
            {BS_SECTIONS.map((_, idx) => (
              <div key={idx} className={`h-2 rounded-full transition-all ${
                idx === currentSection ? 'bg-[#1B3A5C] w-4' : idx < currentSection ? 'bg-[#C9A84C] w-2' : 'bg-slate-200 w-2'
              }`} />
            ))}
          </div>

          {/* Section progress map */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Your progress</p>
            <div className="space-y-2">
              {BS_SECTIONS.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    idx < currentSection ? 'bg-[#C9A84C] text-white'
                    : idx === currentSection ? 'bg-[#1B3A5C] text-white'
                    : 'bg-slate-100 text-slate-400'
                  }`}>
                    {idx < currentSection ? '✓' : idx + 1}
                  </div>
                  <span className={`text-xs leading-tight ${
                    idx === currentSection ? 'text-[#1B3A5C] font-semibold'
                    : idx < currentSection ? 'text-slate-400 line-through'
                    : 'text-slate-400'
                  }`}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
