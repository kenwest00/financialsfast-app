import { NextRequest, NextResponse } from 'next/server';

// ─── Formatting helpers ───────────────────────────────────────────────────────

function dollars(n: number, showNegative = false): string {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  if (showNegative && n < 0) return `(${formatted})`;
  if (n < 0) return `(${formatted})`;
  return formatted;
}

function pct(n: number): string {
  return `${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(1)}%`;
}

function today(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────
// Conservative, CPA-conventional design:
// - Georgia serif throughout (institutional feel)
// - Navy accent for headers only, black for all financial data
// - Right-aligned monospaced numbers
// - Parentheses for negatives (GAAP convention)
// - Minimal color — accepted by the most conservative lenders

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 10.5pt;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 8.5in;
    padding: 0.85in 1in 0.85in 1in;
    min-height: 11in;
    position: relative;
  }

  /* ── Typography ── */
  h1 { font-size: 22pt; color: #1B3A5C; font-weight: bold; letter-spacing: -0.5px; }
  h2 { font-size: 14pt; color: #1B3A5C; font-weight: bold; }
  h3 { font-size: 11pt; color: #1B3A5C; font-weight: bold; margin-bottom: 6px; }

  /* ── Cover page ── */
  .cover {
    display: flex;
    flex-direction: column;
    min-height: 9.3in;
  }

  .cover-top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 20px;
    border-bottom: 1px solid #ddd;
    margin-bottom: 40px;
  }

  .ff-logo {
    width: 36px; height: 36px;
    background: #1B3A5C;
    border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    font-family: Arial, sans-serif;
    font-size: 11px; font-weight: bold;
    color: #C9A84C;
    flex-shrink: 0;
  }

  .ff-brand {
    font-family: Arial, sans-serif;
    font-size: 13pt;
    font-weight: bold;
    color: #1B3A5C;
  }

  .cover-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.5in 0;
  }

  .cover-doc-type {
    font-family: Arial, sans-serif;
    font-size: 10pt;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #C9A84C;
    margin-bottom: 12px;
  }

  .cover-title {
    font-size: 30pt;
    color: #1B3A5C;
    line-height: 1.1;
    margin-bottom: 8px;
    font-weight: bold;
  }

  .cover-business {
    font-size: 18pt;
    color: #333;
    margin-bottom: 36px;
  }

  .cover-rule {
    height: 3px;
    background: #1B3A5C;
    width: 60px;
    margin-bottom: 28px;
  }

  .cover-meta {
    font-size: 10pt;
    color: #444;
    line-height: 2.2;
  }

  .cover-meta span {
    display: inline-block;
    min-width: 180px;
    font-weight: bold;
    color: #111;
  }

  .cover-footer {
    border-top: 1px solid #ddd;
    padding-top: 16px;
    margin-top: 40px;
    font-size: 8pt;
    color: #666;
    line-height: 1.6;
  }

  /* ── Document pages ── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 12px;
    margin-bottom: 20px;
    border-bottom: 2.5px solid #1B3A5C;
  }

  .doc-header-left h2 { margin-bottom: 3px; }
  .doc-header-sub {
    font-size: 9pt;
    color: #555;
    font-style: italic;
    line-height: 1.5;
  }
  .doc-header-right {
    text-align: right;
    font-size: 8.5pt;
    color: #666;
    line-height: 1.8;
  }

  /* ── Financial table ── */
  .fin-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
  }

  .fin-table td {
    padding: 3.5px 0;
    vertical-align: bottom;
    line-height: 1.35;
  }

  .fin-table .label { color: #111; }
  .fin-table .amount {
    text-align: right;
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 10pt;
    white-space: nowrap;
    width: 130px;
  }

  /* Line item (indented) */
  .row-item .label { padding-left: 22px; color: #333; font-size: 10pt; }

  /* Section header (category name) */
  .row-section-header td {
    padding-top: 14px;
    padding-bottom: 3px;
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    font-weight: bold;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #1B3A5C;
  }

  /* Subtotal (e.g. Total Revenue) */
  .row-subtotal td {
    border-top: 1px solid #aaa;
    padding-top: 5px;
    padding-bottom: 5px;
    font-weight: bold;
    font-size: 10.5pt;
  }

  /* Grand total (e.g. Net Income) */
  .row-total td {
    border-top: 2.5px solid #1B3A5C;
    border-bottom: 2.5px solid #1B3A5C;
    padding-top: 7px;
    padding-bottom: 7px;
    font-weight: bold;
    font-size: 12pt;
    color: #1B3A5C;
    background: #f7f9fc;
  }

  /* Negative amounts (losses, expenses) */
  .neg { color: #111; } /* parentheses handle the sign — no red needed for lenders */

  /* Margin percentage inline */
  .margin-line {
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    color: #555;
    font-style: italic;
    padding: 2px 0 8px 22px;
    border-bottom: 1px dashed #ddd;
    margin-bottom: 8px;
  }

  /* ── Notes & Assumptions ── */
  .notes-page h3 { margin-bottom: 10px; }

  .notes-section {
    margin-bottom: 20px;
  }

  .notes-section h4 {
    font-size: 9pt;
    font-family: Arial, sans-serif;
    font-weight: bold;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #1B3A5C;
    border-bottom: 1px solid #ddd;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }

  .notes-section p, .notes-section li {
    font-size: 9.5pt;
    color: #333;
    line-height: 1.65;
    margin-bottom: 5px;
  }

  .notes-section ul { padding-left: 18px; }

  .disclosure-box {
    margin-top: 24px;
    border: 1px solid #ccc;
    padding: 14px 16px;
    background: #fafafa;
  }

  .disclosure-box p {
    font-size: 8.5pt;
    color: #555;
    line-height: 1.6;
  }

  /* ── Page footer ── */
  .page-footer {
    position: absolute;
    bottom: 0.4in;
    left: 1in;
    right: 1in;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #aaa;
    border-top: 0.5px solid #eee;
    padding-top: 6px;
  }

  /* ── Print / page breaks ── */
  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
`;

// ─── Shared page components ───────────────────────────────────────────────────

function coverPage(docType: string, title: string, businessName: string, metaLines: string[], disclaimerExtra = ''): string {
  return `
<div class="page cover">
  <div class="cover-top">
    <div class="ff-logo">FF</div>
    <div class="ff-brand">Financials Fast</div>
  </div>
  <div class="cover-body">
    <div class="cover-doc-type">${docType}</div>
    <div class="cover-title">${title}</div>
    <div class="cover-business">${businessName}</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      ${metaLines.map(l => `<div>${l}</div>`).join('')}
    </div>
  </div>
  <div class="cover-footer">
    <p><strong>PREPARER DISCLOSURE:</strong> This statement was prepared by the business owner using AI-assisted document generation (Financials Fast, financialsfast.com). It is owner-prepared and owner-certified. It has not been reviewed, compiled, or audited by a licensed CPA or accounting firm. This document is intended for informational purposes and loan application support. The business owner certifies that all information provided is accurate to the best of their knowledge. ${disclaimerExtra}</p>
    <p style="margin-top:6px">Generated ${today()} · Financials Fast · financialsfast.com</p>
  </div>
</div>`;
}

function pageFooter(businessName: string, pageLabel: string): string {
  return `
<div class="page-footer">
  <span>${businessName}</span>
  <span>${pageLabel}</span>
  <span>Generated ${today()}</span>
</div>`;
}

function sectionHeader(label: string): string {
  return `<tr class="row-section-header"><td class="label" colspan="2">${label}</td></tr>`;
}

function lineItem(label: string, amount: number, showNeg = false): string {
  return `<tr class="row-item">
    <td class="label">${label}</td>
    <td class="amount ${amount < 0 ? 'neg' : ''}">${dollars(amount, showNeg)}</td>
  </tr>`;
}

function subtotal(label: string, amount: number): string {
  return `<tr class="row-subtotal">
    <td class="label">${label}</td>
    <td class="amount ${amount < 0 ? 'neg' : ''}">${dollars(amount)}</td>
  </tr>`;
}

function grandTotal(label: string, amount: number): string {
  return `<tr class="row-total">
    <td class="label">${label}</td>
    <td class="amount">${dollars(amount)}</td>
  </tr>`;
}

function docHeader(title: string, sub: string, rightLines: string[]): string {
  return `
<div class="doc-header">
  <div class="doc-header-left">
    <h2>${title}</h2>
    <div class="doc-header-sub">${sub}</div>
  </div>
  <div class="doc-header-right">${rightLines.join('<br>')}</div>
</div>`;
}

// ─── P&L TEMPLATE ─────────────────────────────────────────────────────────────

interface PnLData {
  businessName: string;
  period: string;
  periodStart?: string;
  periodEnd?: string;
  reportingBasis: string;
  revenue: Record<string, number>;
  cogs: Record<string, number>;
  opex: Record<string, number>;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  totalOpex: number;
  netIncome: number;
  netMargin: number;
  transactionCount?: number;
  entityType?: string;
  industry?: string;
}

function buildPnLHTML(d: PnLData): string {
  const periodLabel: Record<string, string> = {
    '3': 'Three Months Ended', '6': 'Six Months Ended',
    '12': 'Twelve Months Ended', 'ytd': 'Year to Date',
  };
  const periodText = periodLabel[d.period] || 'Period Ended';
  const basisText = d.reportingBasis === 'accrual' ? 'Accrual Basis' : 'Cash Basis';
  const dateRange = d.periodEnd
    ? (d.periodStart ? `${d.periodStart} – ${d.periodEnd}` : d.periodEnd)
    : '';

  const revenueRows = Object.entries(d.revenue)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => lineItem(k, v))
    .join('');

  const cogsRows = Object.entries(d.cogs)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => lineItem(k, v, true))
    .join('');

  const opexRows = Object.entries(d.opex)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => lineItem(k, v, true))
    .join('');

  const hasCOGS = d.totalCOGS > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>${SHARED_CSS}</style>
</head>
<body>

${coverPage(
  'Profit &amp; Loss Statement',
  'Profit &amp; Loss Statement',
  d.businessName,
  [
    `<span>Reporting Period:</span> ${periodText} ${dateRange}`,
    `<span>Accounting Basis:</span> ${basisText}`,
    `<span>Entity Type:</span> ${d.entityType || 'Small Business'}`,
    `<span>Industry:</span> ${d.industry || '—'}`,
    `<span>Prepared:</span> ${today()}`,
    `<span>Transactions Analyzed:</span> ${d.transactionCount?.toLocaleString() || '—'}`,
  ],
  'This P&L statement is prepared on a ' + basisText.toLowerCase() + ' and follows generally accepted accounting principles for owner-prepared financial statements.'
)}

<!-- Statement Page -->
<div class="page">
  ${docHeader(
    'Profit &amp; Loss Statement',
    `${d.businessName} &nbsp;·&nbsp; ${periodText} ${dateRange} &nbsp;·&nbsp; ${basisText}`,
    [`Prepared: ${today()}`, `Transactions: ${d.transactionCount?.toLocaleString() || '—'}`]
  )}

  <table class="fin-table">
    ${sectionHeader('Revenue')}
    ${revenueRows}
    ${subtotal('Total Revenue', d.totalRevenue)}
  </table>

  ${hasCOGS ? `
  <table class="fin-table">
    ${sectionHeader('Cost of Goods Sold')}
    ${cogsRows}
    ${subtotal('Total Cost of Goods Sold', -d.totalCOGS)}
  </table>` : ''}

  <table class="fin-table">
    ${grandTotal('Gross Profit', d.grossProfit)}
  </table>
  <div class="margin-line">
    <span>Gross Margin</span>
    <span>${pct(d.grossMargin)}</span>
  </div>

  <table class="fin-table">
    ${sectionHeader('Operating Expenses')}
    ${opexRows}
    ${subtotal('Total Operating Expenses', -d.totalOpex)}
  </table>

  <table class="fin-table" style="margin-top:8px">
    ${grandTotal('Net Income', d.netIncome)}
  </table>
  <div class="margin-line">
    <span>Net Margin</span>
    <span>${pct(d.netMargin)}</span>
  </div>

  ${pageFooter(d.businessName, 'Profit &amp; Loss Statement')}
</div>

<!-- Notes & Assumptions Page -->
<div class="page notes-page">
  ${docHeader('Notes &amp; Assumptions', `${d.businessName} &nbsp;·&nbsp; ${periodText} ${dateRange}`, [`Prepared: ${today()}`])}

  <div class="notes-section">
    <h4>Accounting Basis &amp; Methodology</h4>
    <ul>
      <li>This statement is prepared on a <strong>${basisText.toLowerCase()}</strong>, recording transactions when cash is received (revenue) or disbursed (expenses).</li>
      <li>Transactions were classified using a four-layer AI-assisted system: (1) business owner questionnaire matching, (2) known merchant pattern recognition, (3) AI classification with confidence scoring, and (4) owner review of flagged items.</li>
      <li>All transactions below a confidence threshold of 85% were presented to the business owner for manual review and confirmation prior to inclusion.</li>
      <li>This statement covers ${(periodLabel[d.period] || 'the selected period').toLowerCase()} based on ${d.transactionCount?.toLocaleString() || 'analyzed'} bank statement transactions.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h4>Revenue Recognition</h4>
    <ul>
      <li>Revenue represents all business-related credits to the business bank account(s) during the reporting period.</li>
      <li>Transfers between business accounts, loan proceeds, and owner capital contributions are excluded from revenue.</li>
      <li>Credits identified as personal in nature were excluded based on owner questionnaire responses.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h4>Expense Classification</h4>
    <ul>
      <li>Expenses represent all business-related debits during the reporting period, categorized per the owner's business structure and industry.</li>
      <li>Owner draws, personal expenses, and transfers between accounts are excluded.</li>
      <li>Cost of Goods Sold represents direct costs of producing goods or services delivered. All other business expenses are classified as Operating Expenses.</li>
      ${d.totalCOGS === 0 ? '<li>This business is classified as service-based; accordingly, no Cost of Goods Sold is reflected and Gross Profit equals Net Revenue.</li>' : ''}
    </ul>
  </div>

  <div class="notes-section">
    <h4>Limitations &amp; Lender Guidance</h4>
    <ul>
      <li>This statement has not been reviewed, compiled, or audited by a licensed CPA or accounting firm.</li>
      <li>The business owner is responsible for the completeness and accuracy of the underlying bank statement data provided.</li>
      <li>For SBA loan applications: this owner-prepared statement meets SBA Standard Operating Procedure 50 10 7 requirements for owner-prepared financials submitted with loan applications.</li>
      <li>Transaction-level detail supporting all figures above is available upon request.</li>
    </ul>
  </div>

  <div class="disclosure-box">
    <p><strong>Owner Certification:</strong> I, the undersigned business owner, certify that to the best of my knowledge and belief, this Profit &amp; Loss Statement is accurate and complete. All transactions are business-related except as noted. This statement was prepared using AI-assisted transaction classification (Financials Fast) with my direct review and approval of the final figures.</p>
    <br>
    <p>Business Owner Signature: ___________________________________ &nbsp;&nbsp; Date: _______________</p>
    <br>
    <p>Printed Name: ___________________________________ &nbsp;&nbsp; Title: _______________</p>
  </div>

  ${pageFooter(d.businessName, 'Notes &amp; Assumptions')}
</div>

</body>
</html>`;
}

// ─── BALANCE SHEET TEMPLATE ───────────────────────────────────────────────────

interface BalanceSheetData {
  businessName: string;
  statementDate: string;
  entityType: string;
  // Current assets
  cashAndEquivalents: number;
  accountsReceivable: number;
  allowanceForDoubtful: number;
  inventory: number;
  prepaidExpenses: number;
  otherCurrentAssets: number;
  // Non-current assets
  propertyPlantEquipment: number;
  accumulatedDepreciation: number;
  intangibleAssets: number;
  securityDeposits: number;
  otherLongTermAssets: number;
  // Current liabilities
  accountsPayable: number;
  shortTermDebt: number;
  accruedWages: number;
  accruedTaxes: number;
  deferredRevenue: number;
  otherCurrentLiabilities: number;
  // Long-term liabilities
  longTermDebt: number;
  leaseObligations: number;
  otherLongTermLiabilities: number;
  // Equity
  ownerEquity: number;
  retainedEarnings: number;
  commonStock?: number;
  additionalPaidInCapital?: number;
  // Computed
  totalCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  totalCurrentLiabilities: number;
  totalLongTermLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
}

function buildBalanceSheetHTML(d: BalanceSheetData): string {
  const netPPE = d.propertyPlantEquipment - d.accumulatedDepreciation;
  const netAR = d.accountsReceivable - (d.allowanceForDoubtful || 0);

  const isCorp = d.entityType?.includes('Corp');
  const isPartnership = d.entityType === 'Partnership' || d.entityType === 'Multi-Member LLC';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>${SHARED_CSS}</style>
</head>
<body>

${coverPage(
  'Balance Sheet',
  'Balance Sheet',
  d.businessName,
  [
    `<span>As of:</span> ${d.statementDate}`,
    `<span>Entity Type:</span> ${d.entityType}`,
    `<span>Prepared:</span> ${today()}`,
    `<span>Total Assets:</span> ${dollars(d.totalAssets)}`,
    `<span>Total Liabilities:</span> ${dollars(d.totalLiabilities)}`,
    `<span>Total Equity:</span> ${dollars(d.totalEquity)}`,
  ],
  'This balance sheet is prepared in accordance with generally accepted accounting principles (GAAP) using the historical cost basis. Asset values reflect original purchase prices net of accumulated depreciation.'
)}

<!-- Balance Sheet Page -->
<div class="page">
  ${docHeader(
    'Balance Sheet',
    `${d.businessName} &nbsp;·&nbsp; As of ${d.statementDate}`,
    [`Prepared: ${today()}`]
  )}

  <!-- ASSETS -->
  <table class="fin-table">
    ${sectionHeader('Current Assets')}
    ${lineItem('Cash &amp; Cash Equivalents', d.cashAndEquivalents)}
    ${d.accountsReceivable > 0 ? lineItem('Accounts Receivable', d.accountsReceivable) : ''}
    ${d.allowanceForDoubtful > 0 ? lineItem('Less: Allowance for Doubtful Accounts', -d.allowanceForDoubtful, true) : ''}
    ${netAR !== d.accountsReceivable && d.accountsReceivable > 0 ? lineItem('Accounts Receivable, Net', netAR) : ''}
    ${d.inventory > 0 ? lineItem('Inventory', d.inventory) : ''}
    ${d.prepaidExpenses > 0 ? lineItem('Prepaid Expenses', d.prepaidExpenses) : ''}
    ${d.otherCurrentAssets > 0 ? lineItem('Other Current Assets', d.otherCurrentAssets) : ''}
    ${subtotal('Total Current Assets', d.totalCurrentAssets)}

    ${sectionHeader('Non-Current Assets')}
    ${d.propertyPlantEquipment > 0 ? lineItem('Property, Plant &amp; Equipment', d.propertyPlantEquipment) : ''}
    ${d.accumulatedDepreciation > 0 ? lineItem('Less: Accumulated Depreciation', -d.accumulatedDepreciation, true) : ''}
    ${d.propertyPlantEquipment > 0 ? lineItem('PP&amp;E, Net', netPPE) : ''}
    ${d.intangibleAssets > 0 ? lineItem('Intangible Assets', d.intangibleAssets) : ''}
    ${d.securityDeposits > 0 ? lineItem('Security Deposits', d.securityDeposits) : ''}
    ${d.otherLongTermAssets > 0 ? lineItem('Other Long-term Assets', d.otherLongTermAssets) : ''}
    ${subtotal('Total Non-Current Assets', d.totalNonCurrentAssets)}

    ${grandTotal('TOTAL ASSETS', d.totalAssets)}
  </table>

  <div style="height: 24px;"></div>

  <!-- LIABILITIES -->
  <table class="fin-table">
    ${sectionHeader('Current Liabilities')}
    ${d.accountsPayable > 0 ? lineItem('Accounts Payable', d.accountsPayable) : ''}
    ${d.shortTermDebt > 0 ? lineItem('Short-term Debt &amp; Current Portion of LTD', d.shortTermDebt) : ''}
    ${d.accruedWages > 0 ? lineItem('Accrued Wages &amp; Payroll', d.accruedWages) : ''}
    ${d.accruedTaxes > 0 ? lineItem('Accrued Taxes', d.accruedTaxes) : ''}
    ${d.deferredRevenue > 0 ? lineItem('Deferred Revenue', d.deferredRevenue) : ''}
    ${d.otherCurrentLiabilities > 0 ? lineItem('Other Current Liabilities', d.otherCurrentLiabilities) : ''}
    ${subtotal('Total Current Liabilities', d.totalCurrentLiabilities)}

    ${sectionHeader('Long-term Liabilities')}
    ${d.longTermDebt > 0 ? lineItem('Long-term Debt', d.longTermDebt) : ''}
    ${d.leaseObligations > 0 ? lineItem('Lease Obligations (ASC 842)', d.leaseObligations) : ''}
    ${d.otherLongTermLiabilities > 0 ? lineItem('Other Long-term Liabilities', d.otherLongTermLiabilities) : ''}
    ${subtotal('Total Long-term Liabilities', d.totalLongTermLiabilities)}

    ${subtotal("Total Liabilities", d.totalLiabilities)}
  </table>

  <div style="height: 16px;"></div>

  <!-- EQUITY -->
  <table class="fin-table">
    ${sectionHeader(isCorp ? "Stockholders' Equity" : isPartnership ? "Partners' Capital" : "Owner's Equity")}
    ${isCorp && d.commonStock ? lineItem('Common Stock', d.commonStock) : ''}
    ${isCorp && d.additionalPaidInCapital ? lineItem('Additional Paid-in Capital', d.additionalPaidInCapital) : ''}
    ${d.retainedEarnings !== 0 ? lineItem(isCorp ? 'Retained Earnings' : "Owner's Capital", d.retainedEarnings) : ''}
    ${d.ownerEquity !== d.retainedEarnings ? lineItem("Current Year Net Income", d.ownerEquity - d.retainedEarnings) : ''}
    ${subtotal(isCorp ? "Total Stockholders' Equity" : "Total Owner's Equity", d.totalEquity)}

    <tr><td colspan="2" style="padding:4px 0;"></td></tr>
    ${grandTotal("TOTAL LIABILITIES AND EQUITY", d.totalLiabilitiesAndEquity)}
  </table>

  ${pageFooter(d.businessName, 'Balance Sheet')}
</div>

<!-- Notes & Assumptions Page -->
<div class="page notes-page">
  ${docHeader("Notes to Balance Sheet", `${d.businessName} &nbsp;·&nbsp; As of ${d.statementDate}`, [`Prepared: ${today()}`])}

  <div class="notes-section">
    <h4>Basis of Preparation</h4>
    <ul>
      <li>This balance sheet is prepared in conformity with the historical cost principle under U.S. Generally Accepted Accounting Principles (GAAP).</li>
      <li>Assets are recorded at original purchase price, not current market value, except where specifically noted.</li>
      <li>The balance sheet equation is confirmed: Total Assets (${dollars(d.totalAssets)}) = Total Liabilities (${dollars(d.totalLiabilities)}) + Total Equity (${dollars(d.totalEquity)}).</li>
    </ul>
  </div>

  <div class="notes-section">
    <h4>Significant Accounting Policies</h4>
    <ul>
      ${d.inventory > 0 ? '<li><strong>Inventory:</strong> Valued at the lower of cost or net realizable value.</li>' : ''}
      ${d.propertyPlantEquipment > 0 ? '<li><strong>Property, Plant &amp; Equipment:</strong> Stated at historical cost less accumulated depreciation. Depreciation is computed using the straight-line or MACRS method over estimated useful lives.</li>' : ''}
      ${d.intangibleAssets > 0 ? '<li><strong>Intangible Assets:</strong> Recorded at acquisition cost and amortized over their estimated useful lives.</li>' : ''}
      ${d.leaseObligations > 0 ? '<li><strong>Leases (ASC 842):</strong> Operating and finance leases with terms exceeding 12 months are recognized as right-of-use assets and corresponding lease liabilities.</li>' : ''}
      ${d.allowanceForDoubtful > 0 ? '<li><strong>Accounts Receivable:</strong> Stated net of an allowance for doubtful accounts estimated based on historical collection experience.</li>' : ''}
      <li><strong>Income Taxes:</strong> The entity is a pass-through entity for tax purposes; accordingly, no provision for federal income taxes is reflected herein.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h4>Debt Obligations</h4>
    ${d.longTermDebt > 0 || d.shortTermDebt > 0 ? `
    <ul>
      ${d.shortTermDebt > 0 ? `<li>Current portion of long-term debt and short-term obligations: ${dollars(d.shortTermDebt)}</li>` : ''}
      ${d.longTermDebt > 0 ? `<li>Long-term debt, net of current portion: ${dollars(d.longTermDebt)}</li>` : ''}
    </ul>` : '<p>The entity had no outstanding debt obligations as of the statement date.</p>'}
  </div>

  <div class="disclosure-box">
    <p><strong>Owner Certification:</strong> I, the undersigned business owner, certify that to the best of my knowledge and belief, this Balance Sheet is accurate and complete as of ${d.statementDate}. This statement was prepared using guided document collection (Financials Fast) with my direct review and approval.</p>
    <br>
    <p>Business Owner Signature: ___________________________________ &nbsp;&nbsp; Date: _______________</p>
    <br>
    <p>Printed Name: ___________________________________ &nbsp;&nbsp; Title: _______________</p>
  </div>

  ${pageFooter(d.businessName, 'Notes to Balance Sheet')}
</div>

</body>
</html>`;
}

// ─── CASH FLOW TEMPLATE ───────────────────────────────────────────────────────

interface CashFlowMonthData {
  month: string;            // "Jan 2025"
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netCashChange: number;
  endingCashBalance: number;
}

interface CashFlowData {
  businessName: string;
  projectionPeriodMonths: number;
  projectionStartDate: string;
  projectionEndDate: string;
  lenderName: string;
  projectionBasis: string; // conservative | base | optimistic
  beginningCash: number;
  // Operating activities (indirect method — ASC 230)
  netIncome: number;
  depreciationAddBack: number;
  arChange: number;          // increase = use of cash (negative)
  inventoryChange: number;
  apChange: number;          // increase = source of cash (positive)
  accruedLiabilitiesChange: number;
  deferredRevenueChange: number;
  otherWorkingCapitalChange: number;
  totalOperatingCashFlow: number;
  // Investing activities
  equipmentPurchases: number;
  realEstatePurchases: number;
  assetSaleProceeds: number;
  totalInvestingCashFlow: number;
  // Financing activities
  loanProceeds: number;
  loanRepayments: number;
  ownerContributions: number;
  ownerDistributions: number;
  totalFinancingCashFlow: number;
  // Summary
  netCashChange: number;
  endingCash: number;
  // Monthly detail
  monthlyData: CashFlowMonthData[];
  // Assumptions
  baselineMonthlyRevenue: number;
  revenueGrowthRate: number;
  revenueGrowthRatePeriod: string;
  keyAssumptions: string;
  biggestRisks: string;
  minimumCashBuffer: number;
  includeScenarioAnalysis: boolean;
}

function buildCashFlowHTML(d: CashFlowData): string {
  const basisLabel: Record<string, string> = {
    conservative: 'Conservative Case',
    base: 'Base Case',
    optimistic: 'Optimistic Case',
  };

  const monthlyTableRows = d.monthlyData.map(m => `
    <tr>
      <td style="font-size:9pt; padding:3px 0; color:#333;">${m.month}</td>
      <td style="text-align:right; font-family:monospace; font-size:9pt; padding:3px 0;">${dollars(m.operatingCashFlow)}</td>
      <td style="text-align:right; font-family:monospace; font-size:9pt; padding:3px 0;">${dollars(m.investingCashFlow)}</td>
      <td style="text-align:right; font-family:monospace; font-size:9pt; padding:3px 0;">${dollars(m.financingCashFlow)}</td>
      <td style="text-align:right; font-family:monospace; font-size:9pt; padding:3px 0; font-weight:bold;">${dollars(m.netCashChange)}</td>
      <td style="text-align:right; font-family:monospace; font-size:9pt; padding:3px 0; color:#1B3A5C; font-weight:bold;">${dollars(m.endingCashBalance)}</td>
    </tr>
  `).join('');

  // Identify low-cash months
  const lowCashMonths = d.monthlyData.filter(m => m.endingCashBalance < d.minimumCashBuffer);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${SHARED_CSS}
  .cf-section-label {
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    font-weight: bold;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #1B3A5C;
    margin: 18px 0 4px;
  }
  .monthly-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .monthly-table th {
    font-family: Arial, sans-serif;
    font-size: 8pt;
    font-weight: bold;
    text-align: right;
    color: #1B3A5C;
    padding: 4px 0;
    border-bottom: 1.5px solid #1B3A5C;
  }
  .monthly-table th:first-child { text-align: left; }
  .monthly-table tr { border-bottom: 1px solid #f0f0f0; }
  .monthly-table tr:last-child { border-bottom: 2px solid #1B3A5C; font-weight: bold; }
  .low-cash { background: #fff8e6; }
</style>
</head>
<body>

${coverPage(
  'Cash Flow Projection',
  'Statement of Cash Flows',
  d.businessName,
  [
    `<span>Projection Period:</span> ${d.projectionStartDate} – ${d.projectionEndDate}`,
    `<span>Duration:</span> ${d.projectionPeriodMonths} Months`,
    `<span>Scenario:</span> ${basisLabel[d.projectionBasis] || 'Base Case'}`,
    `<span>Prepared for:</span> ${d.lenderName || 'Loan Application'}`,
    `<span>Prepared:</span> ${today()}`,
    `<span>Beginning Cash:</span> ${dollars(d.beginningCash)}`,
    `<span>Projected Ending Cash:</span> ${dollars(d.endingCash)}`,
  ],
  'This cash flow projection uses the indirect method as defined under ASC 230 (Statement of Cash Flows). All figures are projections based on stated assumptions and are not guaranteed results.'
)}

<!-- Cash Flow Statement Page -->
<div class="page">
  ${docHeader(
    'Statement of Cash Flows',
    `${d.businessName} &nbsp;·&nbsp; ${d.projectionPeriodMonths}-Month Projection &nbsp;·&nbsp; ${basisLabel[d.projectionBasis] || 'Base Case'}`,
    [`Period: ${d.projectionStartDate} – ${d.projectionEndDate}`, `Prepared: ${today()}`]
  )}

  <table class="fin-table">
    ${lineItem('Beginning Cash Balance', d.beginningCash)}

    <tr><td colspan="2" style="padding-top:8px;"><div class="cf-section-label">Operating Activities (Indirect Method — ASC 230)</div></td></tr>
    ${lineItem('Net Income', d.netIncome)}
    <tr class="row-item"><td class="label" colspan="2" style="font-size:9pt; color:#888; padding: 2px 0 4px 22px; font-style:italic;">Adjustments to reconcile net income to net cash:</td></tr>
    ${d.depreciationAddBack > 0 ? lineItem('Add: Depreciation &amp; Amortization', d.depreciationAddBack) : ''}
    ${d.arChange !== 0 ? lineItem(`${d.arChange < 0 ? 'Increase' : 'Decrease'} in Accounts Receivable`, d.arChange) : ''}
    ${d.inventoryChange !== 0 ? lineItem(`${d.inventoryChange < 0 ? 'Increase' : 'Decrease'} in Inventory`, d.inventoryChange) : ''}
    ${d.apChange !== 0 ? lineItem(`${d.apChange > 0 ? 'Increase' : 'Decrease'} in Accounts Payable`, d.apChange) : ''}
    ${d.accruedLiabilitiesChange !== 0 ? lineItem('Change in Accrued Liabilities', d.accruedLiabilitiesChange) : ''}
    ${d.deferredRevenueChange !== 0 ? lineItem('Change in Deferred Revenue', d.deferredRevenueChange) : ''}
    ${d.otherWorkingCapitalChange !== 0 ? lineItem('Other Working Capital Changes', d.otherWorkingCapitalChange) : ''}
    ${subtotal('Net Cash from Operating Activities', d.totalOperatingCashFlow)}

    <tr><td colspan="2" style="padding-top:8px;"><div class="cf-section-label">Investing Activities (ASC 230 Section 2)</div></td></tr>
    ${d.equipmentPurchases < 0 ? lineItem('Purchase of Equipment &amp; Fixed Assets', d.equipmentPurchases, true) : ''}
    ${d.realEstatePurchases < 0 ? lineItem('Purchase of Real Estate', d.realEstatePurchases, true) : ''}
    ${d.assetSaleProceeds > 0 ? lineItem('Proceeds from Sale of Assets', d.assetSaleProceeds) : ''}
    ${subtotal('Net Cash from Investing Activities', d.totalInvestingCashFlow)}

    <tr><td colspan="2" style="padding-top:8px;"><div class="cf-section-label">Financing Activities (ASC 230 Section 3)</div></td></tr>
    ${d.loanProceeds > 0 ? lineItem('Proceeds from Loans / New Debt', d.loanProceeds) : ''}
    ${d.loanRepayments < 0 ? lineItem('Repayment of Debt', d.loanRepayments, true) : ''}
    ${d.ownerContributions > 0 ? lineItem('Owner Capital Contributions', d.ownerContributions) : ''}
    ${d.ownerDistributions < 0 ? lineItem('Owner Distributions / Draws', d.ownerDistributions, true) : ''}
    ${subtotal('Net Cash from Financing Activities', d.totalFinancingCashFlow)}
  </table>

  <div style="height:12px"></div>

  <table class="fin-table">
    ${subtotal('Net Increase / (Decrease) in Cash', d.netCashChange)}
    ${lineItem('Beginning Cash Balance', d.beginningCash)}
    ${grandTotal('Ending Cash Balance', d.endingCash)}
  </table>

  ${lowCashMonths.length > 0 ? `
  <div style="margin-top:16px; padding:10px 14px; background:#fff8e6; border-left:3px solid #C9A84C;">
    <p style="font-size:9pt; color:#7a5800;"><strong>Note:</strong> Cash balance is projected to fall below the minimum buffer of ${dollars(d.minimumCashBuffer)} in ${lowCashMonths.length} month(s): ${lowCashMonths.map(m => m.month).join(', ')}. Management has identified this period and will monitor cash position closely.</p>
  </div>` : ''}

  ${pageFooter(d.businessName, 'Statement of Cash Flows')}
</div>

<!-- Monthly Summary Page -->
<div class="page">
  ${docHeader('Monthly Cash Flow Summary', `${d.businessName} &nbsp;·&nbsp; ${d.projectionPeriodMonths}-Month Projection`, [`Prepared: ${today()}`])}

  <table class="monthly-table">
    <thead>
      <tr>
        <th style="text-align:left; width:80px;">Month</th>
        <th>Operating</th>
        <th>Investing</th>
        <th>Financing</th>
        <th>Net Change</th>
        <th>Cash Balance</th>
      </tr>
    </thead>
    <tbody>
      ${monthlyTableRows}
    </tbody>
  </table>

  ${lowCashMonths.length > 0 ? `<p style="font-size:8pt; color:#888; margin-top:8px;">⚠ Highlighted months have projected cash below minimum buffer of ${dollars(d.minimumCashBuffer)}</p>` : ''}

  ${pageFooter(d.businessName, 'Monthly Cash Flow Summary')}
</div>

<!-- Assumptions Page -->
<div class="page notes-page">
  ${docHeader('Assumptions &amp; Key Drivers', `${d.businessName} &nbsp;·&nbsp; ${d.projectionPeriodMonths}-Month Projection`, [`Prepared: ${today()}`])}

  <div class="notes-section">
    <h4>Projection Methodology</h4>
    <ul>
      <li>This projection uses the <strong>indirect method</strong> as defined under ASC 230 — Statement of Cash Flows, beginning with projected net income and adjusting for non-cash items and working capital changes.</li>
      <li>This represents the <strong>${basisLabel[d.projectionBasis] || 'base case'}</strong> scenario. ${d.projectionBasis === 'conservative' ? 'Revenue is projected conservatively and expenses are projected at the high end of expected ranges.' : d.projectionBasis === 'optimistic' ? 'Revenue reflects stronger growth assumptions based on pipeline and market conditions.' : 'Revenue and expense figures represent the most likely outcome based on current business trends.'}</li>
      <li>All projections are forward-looking estimates. Actual results may differ materially.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h4>Revenue Assumptions</h4>
    <ul>
      <li>Baseline monthly revenue: <strong>${dollars(d.baselineMonthlyRevenue)}</strong>, based on trailing 3-month average.</li>
      <li>Growth rate applied: <strong>${d.revenueGrowthRate}%</strong> per ${d.revenueGrowthRatePeriod || 'year'}.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h4>Key Assumptions</h4>
    <p>${d.keyAssumptions || 'Revenue and expense projections are based on historical performance and current business conditions.'}</p>
  </div>

  <div class="notes-section">
    <h4>Risk Factors</h4>
    <p>${d.biggestRisks || 'Results may differ from projections due to market conditions, competition, and other factors outside management control.'}</p>
  </div>

  <div class="notes-section">
    <h4>Minimum Cash Policy</h4>
    <p>Management has established a minimum operating cash reserve of <strong>${dollars(d.minimumCashBuffer)}</strong>. ${lowCashMonths.length > 0 ? `The projection indicates cash may fall below this threshold in ${lowCashMonths.length} month(s). Contingency measures include drawing on the business line of credit or deferring discretionary expenditures.` : 'The projection shows cash remaining above this threshold throughout the entire projection period.'}</p>
  </div>

  <div class="disclosure-box">
    <p><strong>Owner Certification:</strong> I, the undersigned business owner, certify that the assumptions underlying this cash flow projection are reasonable and represent my best estimate of future business performance as of the preparation date. I understand this is a projection, not a guarantee of future results.</p>
    <br>
    <p>Business Owner Signature: ___________________________________ &nbsp;&nbsp; Date: _______________</p>
    <br>
    <p>Printed Name: ___________________________________ &nbsp;&nbsp; Title: _______________</p>
  </div>

  ${pageFooter(d.businessName, 'Assumptions &amp; Key Drivers')}
</div>

</body>
</html>`;
}

// ─── HTML → PDF via Puppeteer ─────────────────────────────────────────────────

async function htmlToPDF(html: string, filename: string): Promise<NextResponse> {
  try {
    const chromium = await import('@sparticuz/chromium-min').catch(() => null);
    const puppeteer = await import('puppeteer-core').catch(() => null);

    if (chromium && puppeteer) {
      const executablePath = await chromium.default.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar'
      );

      const browser = await puppeteer.default.launch({
        args: chromium.default.args,
        defaultViewport: chromium.default.defaultViewport,
        executablePath,
        headless: true,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        displayHeaderFooter: false,
      });

      await browser.close();

      return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }
  } catch (e) {
    console.warn('Puppeteer unavailable, returning HTML fallback:', e);
  }

  // Fallback: return HTML — client prints to PDF via browser dialog
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-PDF-Fallback': 'true',
    },
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentType, pnlData, balanceSheetData, cashFlowData } = body as {
      documentType: 'pnl' | 'balance-sheet' | 'cashflow';
      pnlData?: PnLData;
      balanceSheetData?: BalanceSheetData;
      cashFlowData?: CashFlowData;
    };

    // Legacy: if no documentType, treat as pnl
    const docType = documentType || 'pnl';

    switch (docType) {
      case 'pnl': {
        if (!pnlData) return NextResponse.json({ error: 'pnlData required' }, { status: 400 });
        const html = buildPnLHTML(pnlData);
        const filename = `${pnlData.businessName.replace(/\s+/g, '-')}-PnL.pdf`;
        return htmlToPDF(html, filename);
      }

      case 'balance-sheet': {
        if (!balanceSheetData) return NextResponse.json({ error: 'balanceSheetData required' }, { status: 400 });
        const html = buildBalanceSheetHTML(balanceSheetData);
        const filename = `${balanceSheetData.businessName.replace(/\s+/g, '-')}-BalanceSheet.pdf`;
        return htmlToPDF(html, filename);
      }

      case 'cashflow': {
        if (!cashFlowData) return NextResponse.json({ error: 'cashFlowData required' }, { status: 400 });
        const html = buildCashFlowHTML(cashFlowData);
        const filename = `${cashFlowData.businessName.replace(/\s+/g, '-')}-CashFlow.pdf`;
        return htmlToPDF(html, filename);
      }

      default:
        return NextResponse.json({ error: `Unknown document type: ${docType}` }, { status: 400 });
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
