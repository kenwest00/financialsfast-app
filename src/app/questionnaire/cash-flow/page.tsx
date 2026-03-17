'use client';

// app/questionnaire/cash-flow/page.tsx
// 8-section Cash Flow Projection questionnaire
// Based on ASC 230 — Statement of Cash Flows, Indirect Method
// Sections: Setup → Revenue → Expenses → Working Capital →
//           Investing → Financing → Scenarios → Presentation

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOrCreateSessionId,
  getQuestionnaireData,
  getProductType,
  saveCashFlowProgress,
  type CashFlowData,
  type ProductType,
} from '@/lib/db';

type CFForm = Partial<CashFlowData>;

// ─── Section definitions ──────────────────────────────────────────────────────

const CF_SECTIONS = [
  { id: 'S1', title: 'Projection Setup',        description: 'Period, starting cash, and presentation method' },
  { id: 'S2', title: 'Revenue Assumptions',     description: 'How money will flow in — your operating inflows' },
  { id: 'S3', title: 'Operating Expenses',      description: 'Fixed and variable costs — your operating outflows' },
  { id: 'S4', title: 'Working Capital',         description: 'Timing differences between earning and receiving cash' },
  { id: 'S5', title: 'Investing Activities',    description: 'Planned asset purchases and sales (ASC 230 Section 2)' },
  { id: 'S6', title: 'Financing Activities',    description: 'Loans, owner contributions, and distributions (ASC 230 Section 3)' },
  { id: 'S7', title: 'Assumptions & Scenarios', description: 'Key drivers and risk factors for your projection' },
  { id: 'S8', title: 'Presentation',            description: 'How you want your cash flow report formatted' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700 mb-1">{children}</label>;
}

function HintText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 mt-1 leading-relaxed">{children}</p>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-500 mb-1">{children}</label>;
}

function TextInput({ value, onChange, placeholder, type = 'text', prefix }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; prefix?: string;
}) {
  if (prefix) {
    return (
      <div className="flex">
        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-sm text-slate-500 font-medium">
          {prefix}
        </span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-slate-300 rounded-r-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:border-transparent" />
      </div>
    );
  }
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:border-transparent" />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:border-transparent resize-none" />
  );
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] bg-white">
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
        <button key={String(opt)} type="button" onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
            value === opt
              ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
          }`}>
          {opt ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

function ChoiceGrid({ options, value, onChange }: {
  options: { val: string; label: string; hint?: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className={`grid gap-2 ${options.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((opt) => (
        <button key={opt.val} type="button" onClick={() => onChange(opt.val)}
          className={`p-3 rounded-lg border-2 text-left transition-all ${
            value === opt.val
              ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A5C]'
          }`}>
          <div className="font-bold text-sm">{opt.label}</div>
          {opt.hint && (
            <div className={`text-xs mt-0.5 ${value === opt.val ? 'text-blue-100' : 'text-slate-400'}`}>
              {opt.hint}
            </div>
          )}
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

// Generic repeatable rows
function RepeatableRows<T extends Record<string, string>>({
  rows, onChange, emptyRow, fields, addLabel = '+ Add another',
}: {
  rows: T[]; onChange: (rows: T[]) => void; emptyRow: T;
  fields: { key: keyof T; label: string; placeholder?: string; fullWidth?: boolean }[];
  addLabel?: string;
}) {
  const safeRows = rows.length > 0 ? rows : [{ ...emptyRow }];
  const update = (i: number, key: keyof T, val: string) =>
    onChange(safeRows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
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
                <TextInput value={String(row[f.key] || '')} onChange={(v) => update(i, f.key, v)} placeholder={f.placeholder} />
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

// ─── SECTION 1: Projection Setup ─────────────────────────────────────────────

function Section1({ form, update, prefilled }: {
  form: CFForm; update: (d: Partial<CFForm>) => void;
  prefilled: { businessName?: string; entityType?: string };
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Business name</Label>
        <TextInput value={form.businessName || prefilled.businessName || ''}
          onChange={(v) => update({ businessName: v })} placeholder="e.g. Magnolia Supply LLC" />
        {prefilled.businessName && <HintText>Pre-filled from your questionnaire — edit if needed.</HintText>}
      </div>

      <div>
        <Label>Projection period</Label>
        <ChoiceGrid
          value={form.projectionPeriodMonths || ''}
          onChange={(v) => update({ projectionPeriodMonths: v })}
          options={[
            { val: '12', label: '12 Months', hint: 'Standard for most lenders' },
            { val: '24', label: '24 Months', hint: 'SBA loans often require this' },
            { val: '36', label: '36 Months', hint: 'Longer-term planning' },
          ]}
        />
        <HintText>Most SBA lenders require a 12–24 month cash flow projection. Check your lender's specific requirements.</HintText>
      </div>

      <div>
        <Label>Projection start date</Label>
        <TextInput type="date" value={form.projectionStartDate || ''} onChange={(v) => update({ projectionStartDate: v })} />
        <HintText>Usually the first day of the next month from today.</HintText>
      </div>

      <div>
        <Label>Current cash balance (beginning cash)</Label>
        <TextInput value={form.currentCashBalance || ''} onChange={(v) => update({ currentCashBalance: v })}
          placeholder="e.g. $42,000 — total across all business accounts today" prefix="$" />
        <HintText>This is the starting point of your cash flow statement. Use your total bank balance today.</HintText>
      </div>

      <div>
        <Label>Who is this projection for?</Label>
        <TextInput value={form.lenderName || ''} onChange={(v) => update({ lenderName: v })}
          placeholder="e.g. Chase Bank, SBA, internal planning" />
      </div>
    </div>
  );
}

// ─── SECTION 2: Revenue Assumptions ──────────────────────────────────────────

function Section2({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Average monthly revenue over the last 3 months</Label>
        <TextInput value={form.baselineMonthlyRevenue || ''} onChange={(v) => update({ baselineMonthlyRevenue: v })}
          placeholder="e.g. $28,500" prefix="$" />
        <HintText>This is your baseline. If you have bank statements already uploaded, we'll use those figures. Otherwise enter your best estimate.</HintText>
      </div>

      <div>
        <Label>Expected revenue growth rate</Label>
        <div className="flex gap-3">
          <div className="flex-1">
            <TextInput value={form.revenueGrowthRate || ''} onChange={(v) => update({ revenueGrowthRate: v })}
              placeholder="e.g. 5" prefix="%" />
          </div>
          <div className="w-40">
            <Select value={form.revenueGrowthRatePeriod || 'monthly'} onChange={(v) => update({ revenueGrowthRatePeriod: v })}>
              <option value="monthly">per month</option>
              <option value="annual">per year</option>
            </Select>
          </div>
        </div>
        <HintText>Be conservative — lenders want realistic projections. A 0% growth rate is completely acceptable.</HintText>
      </div>

      <div>
        <Label>Does your business have significant seasonal revenue patterns?</Label>
        <YesNo value={form.hasSeasonalRevenue} onChange={(v) => update({ hasSeasonalRevenue: v })} />
        {form.hasSeasonalRevenue && (
          <div className="mt-3 space-y-3">
            <div>
              <SubLabel>Describe your seasonal pattern</SubLabel>
              <TextInput value={form.seasonalPattern || ''} onChange={(v) => update({ seasonalPattern: v })}
                placeholder="e.g. Peak Oct–Dec (holiday), slow Jan–Feb" />
            </div>
            <div>
              <SubLabel>High-revenue months (revenue multiplier vs baseline)</SubLabel>
              <TextInput value={form.seasonalMonths || ''} onChange={(v) => update({ seasonalMonths: v })}
                placeholder="e.g. Oct: 1.8x, Nov: 2.2x, Dec: 2.5x, Jan: 0.6x" />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Do you have contracted or committed future revenue?</Label>
        <YesNo value={form.hasContractedRevenue} onChange={(v) => update({ hasContractedRevenue: v })} />
        {form.hasContractedRevenue && (
          <div className="mt-2">
            <TextArea value={form.contractedRevenueDesc || ''} onChange={(v) => update({ contractedRevenueDesc: v })}
              placeholder="e.g. 12-month retainer with ABC Corp $5,000/mo starting April, signed purchase order from XYZ for $45,000 in Q2" />
          </div>
        )}
      </div>

      <div>
        <Label>Are there any new revenue streams you expect to launch?</Label>
        <TextArea value={form.newRevenueStreams || ''} onChange={(v) => update({ newRevenueStreams: v })}
          placeholder="e.g. New product line launching June — expect $3,000/month by month 3. Leave blank if none." rows={2} />
      </div>
    </div>
  );
}

// ─── SECTION 3: Operating Expenses ───────────────────────────────────────────

function Section3({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Fixed expenses</strong> stay the same regardless of revenue (rent, payroll, insurance).
          <strong> Variable expenses</strong> change proportionally with revenue (cost of goods, sales commissions).
        </p>
      </div>

      <div>
        <Label>Monthly fixed expenses</Label>
        <HintText>Enter monthly amounts for each. Leave blank if not applicable.</HintText>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { key: 'monthlyRent', label: 'Rent & lease', placeholder: 'e.g. $4,200' },
            { key: 'monthlyPayroll', label: 'Payroll & wages', placeholder: 'e.g. $18,000' },
            { key: 'monthlyInsurance', label: 'Insurance', placeholder: 'e.g. $850' },
            { key: 'monthlySubscriptions', label: 'Software & subscriptions', placeholder: 'e.g. $650' },
          ].map((item) => (
            <div key={item.key}>
              <SubLabel>{item.label}</SubLabel>
              <TextInput
                value={String(form[item.key as keyof CFForm] || '')}
                onChange={(v) => update({ [item.key]: v } as Partial<CFForm>)}
                placeholder={item.placeholder}
                prefix="$"
              />
            </div>
          ))}
          <div className="col-span-2">
            <SubLabel>Existing loan & debt payments (monthly total)</SubLabel>
            <TextInput value={form.monthlyLoanPayments || ''} onChange={(v) => update({ monthlyLoanPayments: v })}
              placeholder="e.g. $3,400 — SBA loan + vehicle" prefix="$" />
          </div>
          <div className="col-span-2">
            <SubLabel>Other fixed monthly expenses</SubLabel>
            <TextInput value={form.otherFixedExpenses || ''} onChange={(v) => update({ otherFixedExpenses: v })}
              placeholder="e.g. $1,200 — utilities, phone, internet, accounting" prefix="$" />
          </div>
        </div>
      </div>

      <div>
        <Label>Variable expenses as a percentage of monthly revenue</Label>
        <HintText>These scale up and down with your revenue. Enter 0 if not applicable.</HintText>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { key: 'cogsPercent', label: 'Cost of goods sold', placeholder: 'e.g. 35' },
            { key: 'salesMarketingPercent', label: 'Sales & marketing', placeholder: 'e.g. 8' },
            { key: 'otherVariablePercent', label: 'Other variable', placeholder: 'e.g. 5' },
          ].map((item) => (
            <div key={item.key}>
              <SubLabel>{item.label}</SubLabel>
              <TextInput
                value={String(form[item.key as keyof CFForm] || '')}
                onChange={(v) => update({ [item.key]: v } as Partial<CFForm>)}
                placeholder={item.placeholder}
                prefix="%"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Are any expenses expected to change significantly during the projection period?</Label>
        <TextArea value={form.expenseChanges || ''} onChange={(v) => update({ expenseChanges: v })}
          placeholder="e.g. Hiring 2 new employees in Month 4 (+$8,000/mo payroll), lease renewal at higher rate in Month 7 (+$500/mo). Leave blank if expenses are stable." />
      </div>
    </div>
  );
}

// ─── SECTION 4: Working Capital ───────────────────────────────────────────────

function Section4({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Working capital timing</strong> is the difference between when you earn money and when you actually receive it.
          Under ASC 230 indirect method, these timing differences are shown as adjustments to net income.
          For example: if customers take 30 days to pay, your cash lags your revenue by one month.
        </p>
      </div>

      <div>
        <Label>Do your customers pay you on credit? (Accounts Receivable)</Label>
        <YesNo value={form.hasAccountsReceivable} onChange={(v) => update({ hasAccountsReceivable: v })} />
        {form.hasAccountsReceivable && (
          <div className="mt-3 space-y-3">
            <div>
              <SubLabel>Average days to collect from customers</SubLabel>
              <ChoiceGrid
                value={form.arDaysOutstanding || ''}
                onChange={(v) => update({ arDaysOutstanding: v })}
                options={[
                  { val: '15', label: '15 days' },
                  { val: '30', label: '30 days', hint: 'Net 30 terms' },
                  { val: '45', label: '45 days' },
                  { val: '60', label: '60 days', hint: 'Net 60 terms' },
                  { val: '90', label: '90 days' },
                  { val: 'varies', label: 'Varies' },
                ]}
              />
            </div>
            <div>
              <SubLabel>Do you expect AR to grow during the projection period?</SubLabel>
              <YesNo value={form.arGrowthExpected} onChange={(v) => update({ arGrowthExpected: v })} />
              <HintText>Growing AR means cash comes in slower than revenue grows — important for lenders to understand.</HintText>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Do you carry inventory?</Label>
        <YesNo value={form.hasInventory} onChange={(v) => update({ hasInventory: v })} />
        {form.hasInventory && (
          <div className="mt-3">
            <SubLabel>Average days of inventory on hand</SubLabel>
            <ChoiceGrid
              value={form.inventoryDaysOnHand || ''}
              onChange={(v) => update({ inventoryDaysOnHand: v })}
              options={[
                { val: '15', label: '15 days' },
                { val: '30', label: '30 days' },
                { val: '45', label: '45 days' },
                { val: '60', label: '60 days' },
                { val: '90', label: '90 days' },
                { val: '120+', label: '120+ days' },
              ]}
            />
            <HintText>Higher inventory days means more cash tied up in stock. This impacts your operating cash flow.</HintText>
          </div>
        )}
      </div>

      <div>
        <Label>Do you pay your suppliers on credit? (Accounts Payable)</Label>
        <YesNo value={form.hasAccountsPayable} onChange={(v) => update({ hasAccountsPayable: v })} />
        {form.hasAccountsPayable && (
          <div className="mt-3">
            <SubLabel>Average days you take to pay suppliers</SubLabel>
            <ChoiceGrid
              value={form.apDaysOutstanding || ''}
              onChange={(v) => update({ apDaysOutstanding: v })}
              options={[
                { val: '10', label: '10 days' },
                { val: '15', label: '15 days' },
                { val: '30', label: '30 days', hint: 'Net 30' },
                { val: '45', label: '45 days' },
                { val: '60', label: '60 days', hint: 'Net 60' },
                { val: 'varies', label: 'Varies' },
              ]}
            />
            <HintText>Longer AP days = you hold onto cash longer. This is a positive for cash flow.</HintText>
          </div>
        )}
      </div>

      <div>
        <Label>Any other working capital notes for the lender?</Label>
        <TextArea value={form.otherWorkingCapitalNotes || ''} onChange={(v) => update({ otherWorkingCapitalNotes: v })}
          placeholder="e.g. We require large deposits from customers before work begins, which helps cash flow significantly." rows={2} />
      </div>
    </div>
  );
}

// ─── SECTION 5: Investing Activities ─────────────────────────────────────────

const EMPTY_EQUIPMENT_PURCHASE = { description: '', amount: '', month: '' };
const EMPTY_REAL_ESTATE = { description: '', amount: '', month: '' };

function Section5({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Investing activities</strong> are cash flows from buying or selling long-term assets.
          These appear separately from operations in your cash flow statement (ASC 230).
          If you have no planned purchases, answer No to both questions below.
        </p>
      </div>

      <div>
        <Label>Are you planning to purchase any equipment, machinery, or technology during this period?</Label>
        <YesNo value={form.hasPlannedEquipmentPurchases} onChange={(v) => update({ hasPlannedEquipmentPurchases: v })} />
        {form.hasPlannedEquipmentPurchases && (
          <div className="mt-3">
            <RepeatableRows
              rows={(form.equipmentPurchases?.length ? form.equipmentPurchases : [{ ...EMPTY_EQUIPMENT_PURCHASE }]) as typeof EMPTY_EQUIPMENT_PURCHASE[]}
              onChange={(rows) => update({ equipmentPurchases: rows })}
              emptyRow={EMPTY_EQUIPMENT_PURCHASE}
              fields={[
                { key: 'description', label: 'What are you buying?', placeholder: 'e.g. CNC machine, company van, computers' },
                { key: 'amount', label: 'Estimated cost', placeholder: 'e.g. $45,000' },
                { key: 'month', label: 'Which month?', placeholder: 'e.g. Month 3, or April 2025', fullWidth: true },
              ]}
              addLabel="+ Add another purchase"
            />
          </div>
        )}
      </div>

      <div>
        <Label>Are you planning to purchase real estate or make a major capital investment?</Label>
        <YesNo value={form.hasPlannedRealEstate} onChange={(v) => update({ hasPlannedRealEstate: v })} />
        {form.hasPlannedRealEstate && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <SubLabel>Purchase amount</SubLabel>
              <TextInput value={form.realEstatePurchaseAmount || ''} onChange={(v) => update({ realEstatePurchaseAmount: v })}
                placeholder="e.g. $350,000" prefix="$" />
            </div>
            <div>
              <SubLabel>Which month?</SubLabel>
              <TextInput value={form.realEstatePurchaseMonth || ''} onChange={(v) => update({ realEstatePurchaseMonth: v })}
                placeholder="e.g. Month 6" />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Are you planning to sell any business assets during this period?</Label>
        <YesNo value={form.hasAssetSales} onChange={(v) => update({ hasAssetSales: v })} />
        {form.hasAssetSales && (
          <div className="mt-2">
            <TextArea value={form.assetSalesDesc || ''} onChange={(v) => update({ assetSalesDesc: v })}
              placeholder="e.g. Selling old delivery van in Month 2 — expect $8,000. Selling unused warehouse equipment ~$15,000." rows={2} />
          </div>
        )}
      </div>

      <div>
        <Label>Estimated monthly depreciation on existing assets</Label>
        <TextInput value={form.monthlyDepreciation || ''} onChange={(v) => update({ monthlyDepreciation: v })}
          placeholder="e.g. $1,200" prefix="$" />
        <HintText>
          Depreciation is a non-cash expense — under the indirect method it gets added back to net income.
          Find this on your tax return (Schedule C Line 13) or ask your accountant. Enter 0 if unsure.
        </HintText>
      </div>
    </div>
  );
}

// ─── SECTION 6: Financing Activities ─────────────────────────────────────────

const EMPTY_LOAN_PAYMENT = { lender: '', monthlyPayment: '', payoffMonth: '' };
const EMPTY_NEW_DEBT = { lender: '', amount: '', month: '', monthlyPayment: '' };

function Section6({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Existing loan payments</Label>
        <HintText>List all current loans and their monthly payment amounts. Include any that will pay off during the projection period.</HintText>
        <div className="mt-2">
          <RepeatableRows
            rows={(form.existingLoanPayments?.length ? form.existingLoanPayments : [{ ...EMPTY_LOAN_PAYMENT }]) as typeof EMPTY_LOAN_PAYMENT[]}
            onChange={(rows) => update({ existingLoanPayments: rows })}
            emptyRow={EMPTY_LOAN_PAYMENT}
            fields={[
              { key: 'lender', label: 'Lender / loan type', placeholder: 'e.g. SBA loan, Chase LOC, equipment finance' },
              { key: 'monthlyPayment', label: 'Monthly payment', placeholder: 'e.g. $2,100' },
              { key: 'payoffMonth', label: 'Payoff month (if within period)', placeholder: 'e.g. Month 18, or N/A', fullWidth: true },
            ]}
            addLabel="+ Add another loan"
          />
        </div>
      </div>

      <div>
        <Label>Are you planning to take on any new debt during this projection period?</Label>
        <YesNo value={form.hasPlannedNewDebt} onChange={(v) => update({ hasPlannedNewDebt: v })} />
        {form.hasPlannedNewDebt && (
          <div className="mt-3">
            <HintText>Include the loan you may be applying for now — lenders want to see it in your projection.</HintText>
            <div className="mt-2">
              <RepeatableRows
                rows={(form.plannedNewDebt?.length ? form.plannedNewDebt : [{ ...EMPTY_NEW_DEBT }]) as typeof EMPTY_NEW_DEBT[]}
                onChange={(rows) => update({ plannedNewDebt: rows })}
                emptyRow={EMPTY_NEW_DEBT}
                fields={[
                  { key: 'lender', label: 'Lender / purpose', placeholder: 'e.g. SBA 7(a) for equipment' },
                  { key: 'amount', label: 'Loan amount', placeholder: 'e.g. $150,000' },
                  { key: 'month', label: 'Funding month', placeholder: 'e.g. Month 1' },
                  { key: 'monthlyPayment', label: 'Monthly payment', placeholder: 'e.g. $2,800', fullWidth: true },
                ]}
                addLabel="+ Add another planned loan"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Do you have a business line of credit?</Label>
        <YesNo value={form.hasLineOfCredit} onChange={(v) => update({ hasLineOfCredit: v })} />
        {form.hasLineOfCredit && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <SubLabel>Line of credit limit</SubLabel>
              <TextInput value={form.locLimit || ''} onChange={(v) => update({ locLimit: v })}
                placeholder="e.g. $100,000" prefix="$" />
            </div>
            <div>
              <SubLabel>Current balance drawn</SubLabel>
              <TextInput value={form.locCurrentBalance || ''} onChange={(v) => update({ locCurrentBalance: v })}
                placeholder="e.g. $35,000" prefix="$" />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Owner contributions planned during this period</Label>
        <TextInput value={form.ownerContributionsPlanned || ''} onChange={(v) => update({ ownerContributionsPlanned: v })}
          placeholder="Total additional capital you plan to inject (e.g. $25,000 in Month 2) — enter 0 if none" prefix="$" />
      </div>

      <div>
        <Label>Monthly owner distributions or draws planned</Label>
        <TextInput value={form.ownerDistributionsPlanned || ''} onChange={(v) => update({ ownerDistributionsPlanned: v })}
          placeholder="Monthly amount you plan to take out (e.g. $5,000/month) — enter 0 if none" prefix="$" />
        <HintText>Owner draws reduce your cash balance but are not an operating expense. They appear in financing activities.</HintText>
      </div>
    </div>
  );
}

// ─── SECTION 7: Assumptions & Scenarios ──────────────────────────────────────

function Section7({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Which scenario does this projection represent?</Label>
        <ChoiceGrid
          value={form.projectionBasis || ''}
          onChange={(v) => update({ projectionBasis: v })}
          options={[
            { val: 'conservative', label: 'Conservative', hint: 'Lower revenue, higher costs' },
            { val: 'base', label: 'Base Case', hint: 'Most likely scenario' },
            { val: 'optimistic', label: 'Optimistic', hint: 'Higher revenue growth' },
          ]}
        />
        <HintText>Most lenders prefer to see a base case. Conservative projections demonstrate prudent management.</HintText>
      </div>

      <div>
        <Label>Minimum cash balance you want to maintain</Label>
        <TextInput value={form.minimumCashBuffer || ''} onChange={(v) => update({ minimumCashBuffer: v })}
          placeholder="e.g. $10,000 — your cash safety floor" prefix="$" />
        <HintText>We'll flag any month in the projection where cash drops below this threshold — important for lenders to see you've planned for this.</HintText>
      </div>

      <div>
        <Label>Are there any known one-time events during this projection period?</Label>
        <YesNo value={form.hasKnownOneTimeEvents} onChange={(v) => update({ hasKnownOneTimeEvents: v })} />
        {form.hasKnownOneTimeEvents && (
          <div className="mt-2">
            <TextArea value={form.oneTimeEventsDesc || ''} onChange={(v) => update({ oneTimeEventsDesc: v })}
              placeholder="e.g. Annual tax payment ~$18,000 in April, trade show expense $8,000 in September, seasonal inventory build-up $25,000 in October" />
          </div>
        )}
      </div>

      <div>
        <Label>Key assumptions driving this projection</Label>
        <TextArea value={form.keyAssumptions || ''} onChange={(v) => update({ keyAssumptions: v })}
          placeholder="e.g. Revenue growth assumes two new contracts closing in Q2. Payroll assumes no new hires until Month 6. Assumes current supplier pricing holds throughout the period."
          rows={3} />
        <HintText>These assumptions will appear in the projection's cover page — lenders review them carefully.</HintText>
      </div>

      <div>
        <Label>What are the biggest risks to this projection?</Label>
        <TextArea value={form.biggestRisks || ''} onChange={(v) => update({ biggestRisks: v })}
          placeholder="e.g. Loss of a major customer (~30% of revenue), supply chain disruptions increasing COGS, interest rate increases on variable debt"
          rows={3} />
        <HintText>Identifying risks honestly builds credibility with lenders — they know risks exist and appreciate when you do too.</HintText>
      </div>

      <div>
        <Label>Would you like to include a sensitivity / scenario analysis?</Label>
        <YesNo value={form.includeScenarioAnalysis} onChange={(v) => update({ includeScenarioAnalysis: v })} />
        <HintText>A scenario analysis shows best case / base case / worst case side by side. Adds 1–2 pages to the report but demonstrates strong financial planning to lenders.</HintText>
      </div>
    </div>
  );
}

// ─── SECTION 8: Presentation ──────────────────────────────────────────────────

function Section8({ form, update }: { form: CFForm; update: (d: Partial<CFForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Presentation frequency</Label>
        <ChoiceGrid
          value={form.presentationFrequency || ''}
          onChange={(v) => update({ presentationFrequency: v })}
          options={[
            { val: 'monthly', label: 'Monthly', hint: 'Column per month — most detailed' },
            { val: 'quarterly', label: 'Quarterly', hint: 'Column per quarter — cleaner for longer periods' },
          ]}
        />
        <HintText>Monthly is standard for 12-month projections. Quarterly works better for 24–36 month projections to keep the report readable.</HintText>
      </div>

      <div>
        <Label>Include a cash waterfall chart?</Label>
        <YesNo value={form.includeCashWaterfall} onChange={(v) => update({ includeCashWaterfall: v })} />
        <HintText>A visual month-by-month bar chart showing your cash balance trajectory. Strongly recommended — lenders respond well to visuals.</HintText>
      </div>

      <div>
        <Label>Include a detailed assumptions page?</Label>
        <YesNo value={form.includeAssumptionsPage} onChange={(v) => update({ includeAssumptionsPage: v })} />
        <HintText>A separate page listing every assumption behind the numbers. Required by some SBA lenders. Recommended for any projection over $100,000 in requested financing.</HintText>
      </div>

      <div>
        <Label>Include a variance analysis section?</Label>
        <YesNo value={form.includeVarianceAnalysis} onChange={(v) => update({ includeVarianceAnalysis: v })} />
        <HintText>If you have historical actuals from the past 6–12 months, we can show projected vs. actual side by side — demonstrates accuracy of your forecasting methodology.</HintText>
      </div>
    </div>
  );
}

// ─── Confirmation messages ────────────────────────────────────────────────────

function getCFConfirmation(idx: number, form: CFForm): string {
  const msgs = [
    `${form.projectionPeriodMonths || '12'}-month cash flow projection for ${form.businessName || 'your business'} starting from ${form.currentCashBalance || '?'} in beginning cash.`,
    `Baseline revenue of ${form.baselineMonthlyRevenue || '?'}/month with ${form.revenueGrowthRate || '0'}% ${form.revenueGrowthRatePeriod || 'annual'} growth. ${form.hasSeasonalRevenue ? 'Seasonal patterns captured.' : 'Flat revenue pattern.'}`,
    `Fixed expenses captured. Variable costs at ${[form.cogsPercent && `${form.cogsPercent}% COGS`, form.salesMarketingPercent && `${form.salesMarketingPercent}% sales`].filter(Boolean).join(', ') || 'stated rates'} of revenue.`,
    `Working capital timing: ${form.hasAccountsReceivable ? `${form.arDaysOutstanding || '?'} day AR` : 'no AR'}${form.hasInventory ? `, ${form.inventoryDaysOnHand || '?'} day inventory` : ''}${form.hasAccountsPayable ? `, ${form.apDaysOutstanding || '?'} day AP` : ''}.`,
    `Investing activities ${form.hasPlannedEquipmentPurchases || form.hasPlannedRealEstate ? 'include planned capital expenditures' : 'show no planned major purchases'}. Monthly depreciation add-back: ${form.monthlyDepreciation || '$0'}.`,
    `Financing: existing loan payments captured, ${form.hasPlannedNewDebt ? 'new debt planned' : 'no new debt planned'}. Owner distributions: ${form.ownerDistributionsPlanned || '$0'}/month.`,
    `${form.projectionBasis || 'Base case'} projection with ${form.minimumCashBuffer || '?'} minimum cash floor. ${form.includeScenarioAnalysis ? 'Scenario analysis included.' : ''}`,
    `Report will be ${form.presentationFrequency || 'monthly'} format${form.includeCashWaterfall ? ' with cash waterfall chart' : ''}${form.includeAssumptionsPage ? ' and assumptions page' : ''}. Heading to checkout.`,
  ];
  return msgs[idx] || 'Section complete.';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CashFlowQuestionnairePage() {
  const router = useRouter();
  const [productType, setProductType] = useState<ProductType>('cashflow');
  const [currentSection, setCurrentSection] = useState(0);
  const [form, setForm] = useState<CFForm>({
    projectionPeriodMonths: '12',
    revenueGrowthRatePeriod: 'annual',
    projectionBasis: 'base',
    presentationFrequency: 'monthly',
    equipmentPurchases: [],
    existingLoanPayments: [],
    plannedNewDebt: [],
  });
  const [prefilled, setPrefilled] = useState<{ businessName?: string; entityType?: string }>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalSections = CF_SECTIONS.length;
  const progressPct = Math.round(((currentSection + 1) / totalSections) * 100);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    const pt = getProductType();
    setProductType(pt);

    // Restore saved CF progress
    try {
      const saved = sessionStorage.getItem('ff_cf_data');
      if (saved) {
        const parsed = JSON.parse(saved) as CFForm & { currentCfSection?: number };
        const { currentCfSection, ...rest } = parsed;
        setForm((prev) => ({ ...prev, ...rest }));
        if (typeof currentCfSection === 'number') setCurrentSection(currentCfSection);
      }
    } catch { /* ignore */ }

    // Pre-fill from P&L or BS questionnaire if bundle
    getQuestionnaireData(sid).then((data) => {
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

  const update = useCallback((patch: Partial<CFForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setShowConfirmation(false);
  }, []);

  const handleNext = async () => {
    setIsSaving(true);
    try {
      const sid = getOrCreateSessionId();
      await saveCashFlowProgress(sid, { ...form, currentCfSection: currentSection + 1 });
      sessionStorage.setItem('ff_cf_data', JSON.stringify({ ...form, currentCfSection: currentSection + 1 }));
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
      // For bundle, go back to balance sheet questionnaire
      const pt = getProductType();
      if (pt === 'bundle') router.push('/questionnaire/balance-sheet');
      else router.push('/');
    } else {
      setCurrentSection((s) => s - 1);
      setShowConfirmation(false);
    }
  };

  const currentSectionDef = CF_SECTIONS[currentSection];
  const isLastSection = currentSection === totalSections - 1;
  const isBundlePhase = productType === 'bundle';

  const sectionComponents: Record<string, React.ReactNode> = {
    S1: <Section1 form={form} update={update} prefilled={prefilled} />,
    S2: <Section2 form={form} update={update} />,
    S3: <Section3 form={form} update={update} />,
    S4: <Section4 form={form} update={update} />,
    S5: <Section5 form={form} update={update} />,
    S6: <Section6 form={form} update={update} />,
    S7: <Section7 form={form} update={update} />,
    S8: <Section8 form={form} update={update} />,
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
          Cash Flow · {currentSection + 1} of {totalSections}
        </span>
      </header>

      {/* Progress */}
      <div className="w-full h-1 bg-slate-200">
        <div className="h-1 bg-[#C9A84C] transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Bundle phase banner */}
      {isBundlePhase && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 text-center text-xs font-medium text-amber-700">
          Complete Financial Package · P&L ✓ · Balance Sheet ✓ — now completing your cash flow projection
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* Section header */}
          <div className="mb-6">
            <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">
              Cash Flow Projection · Section {currentSection + 1}
            </span>
            <h1 className="text-xl font-bold text-[#1B3A5C] mt-1">{currentSectionDef?.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{currentSectionDef?.description}</p>
          </div>

          {/* Form or confirmation */}
          {!showConfirmation ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              {currentSectionDef && sectionComponents[currentSectionDef.id]}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ConfirmationCard message={getCFConfirmation(currentSection, form)} />
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
            {CF_SECTIONS.map((_, idx) => (
              <div key={idx} className={`h-2 rounded-full transition-all ${
                idx === currentSection ? 'bg-[#1B3A5C] w-4' : idx < currentSection ? 'bg-[#C9A84C] w-2' : 'bg-slate-200 w-2'
              }`} />
            ))}
          </div>

          {/* Section progress map */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Your progress</p>
            <div className="space-y-2">
              {CF_SECTIONS.map((s, idx) => (
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
