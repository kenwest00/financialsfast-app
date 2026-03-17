import { NextRequest, NextResponse } from 'next/server';

// ─── Shared utilities ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  // Parentheses for negatives — GAAP convention
  if (n < 0) return `(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n))})`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${n >= 0 ? '' : '('}${Math.abs(n).toFixed(1)}%${n < 0 ? ')' : ''}`;
}

function today(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────
// Traditional CPA-style: Georgia serif, black on white, tabular numerals,
// parentheses for negatives, double-underline on net totals.

const BASE_CSS = `
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
    min-height: 11in;
    padding: 0.85in 1in 0.85in 1in;
    page-break-after: always;
    position: relative;
  }

  /* ── Page header (appears on every content page) ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 10pt;
    border-bottom: 2pt solid #111;
    margin-bottom: 18pt;
  }

  .page-header-left h1 {
    font-size: 15pt;
    font-weight: bold;
    color: #111;
    letter-spacing: -0.3px;
  }

  .page-header-left .sub {
    font-size: 9pt;
    color: #444;
    margin-top: 3pt;
    line-height: 1.5;
  }

  .page-header-right {
    text-align: right;
    font-size: 8.5pt;
    color: #555;
    line-height: 1.7;
  }

  /* ── Section labels ── */
  .section-label {
    font-size: 8pt;
    font-weight: bold;
    letter-spacing: 1.2pt;
    text-transform: uppercase;
    color: #111;
    margin: 16pt 0 4pt;
    padding-bottom: 2pt;
    border-bottom: 0.5pt solid #999;
  }

  /* ── Financial table ── */
  table.fin {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2pt;
  }

  table.fin td {
    padding: 3pt 0;
    vertical-align: middle;
    font-size: 10pt;
  }

  table.fin td.num {
    text-align: right;
    font-family: 'Courier New', 'Courier', monospace;
    font-size: 10pt;
    white-space: nowrap;
    width: 90pt;
  }

  /* Line item — indented detail */
  table.fin tr.item td { padding: 2.5pt 0; }
  table.fin tr.item td.label { padding-left: 18pt; color: #333; font-size: 9.5pt; }

  /* Subtotal row */
  table.fin tr.subtotal td {
    font-weight: bold;
    border-top: 0.5pt solid #111;
    padding-top: 4pt;
    padding-bottom: 4pt;
  }

  /* Total row — double underline */
  table.fin tr.total td {
    font-weight: bold;
    font-size: 11pt;
    border-top: 0.75pt solid #111;
    border-bottom: 2.5pt double #111;
    padding-top: 5pt;
    padding-bottom: 6pt;
  }

  /* Grand total (net income / ending cash) */
  table.fin tr.grand-total td {
    font-weight: bold;
    font-size: 12pt;
    border-top: 0.75pt solid #111;
    border-bottom: 3pt double #111;
    padding-top: 6pt;
    padding-bottom: 7pt;
  }

  /* Negative numbers shown in parentheses — same color, not red (CPA convention) */
  .neg { color: #111; }

  /* Spacer row */
  table.fin tr.spacer td { padding: 5pt 0; border: none; }

  /* ── Key metrics bar ── */
  .metrics {
    display: flex;
    gap: 0;
    border: 0.5pt solid #bbb;
    margin: 16pt 0;
  }
  .metric {
    flex: 1;
    padding: 10pt 12pt;
    border-right: 0.5pt solid #bbb;
  }
  .metric:last-child { border-right: none; }
  .metric-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.8pt; color: #555; margin-bottom: 3pt; }
  .metric-value { font-size: 13pt; font-weight: bold; color: #111; font-family: 'Courier New', monospace; }
  .metric-sub { font-size: 8pt; color: #666; margin-top: 2pt; }

  /* ── Cover page ── */
  .cover {
    display: flex;
    flex-direction: column;
    min-height: 10in;
  }
  .cover-brand {
    display: flex;
    align-items: center;
    gap: 10pt;
    margin-bottom: 0;
  }
  .cover-logo {
    width: 32pt;
    height: 32pt;
    background: #1B3A5C;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4pt;
  }
  .cover-logo span {
    color: #C9A84C;
    font-weight: bold;
    font-size: 10pt;
    font-family: Arial, sans-serif;
  }
  .cover-brand-name {
    font-family: Arial, sans-serif;
    font-size: 12pt;
    font-weight: bold;
    color: #1B3A5C;
  }

  .cover-rule { border: none; border-top: 1pt solid #ccc; margin: 48pt 0; }

  .cover-doc-type {
    font-size: 10pt;
    font-weight: bold;
    letter-spacing: 2pt;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 12pt;
  }
  .cover-title {
    font-size: 30pt;
    font-weight: bold;
    color: #111;
    line-height: 1.15;
    margin-bottom: 6pt;
  }
  .cover-business {
    font-size: 16pt;
    color: #1B3A5C;
    margin-bottom: 40pt;
  }

  .cover-meta table { width: auto; }
  .cover-meta td {
    font-size: 9.5pt;
    padding: 3pt 16pt 3pt 0;
    color: #333;
    vertical-align: top;
  }
  .cover-meta td:first-child { font-weight: bold; color: #111; white-space: nowrap; }

  .cover-spacer { flex: 1; }

  .cover-footer {
    margin-top: auto;
    padding-top: 16pt;
    border-top: 0.5pt solid #bbb;
    font-size: 7.5pt;
    color: #777;
    line-height: 1.55;
  }

  /* ── Notes page ── */
  .notes-title { font-size: 13pt; font-weight: bold; margin-bottom: 16pt; }
  .notes-section { margin-bottom: 16pt; }
  .notes-section h3 { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8pt; margin-bottom: 6pt; border-bottom: 0.5pt solid #ccc; padding-bottom: 3pt; }
  .notes-section p, .notes-section li { font-size: 9pt; color: #333; line-height: 1.65; margin-bottom: 4pt; }
  .notes-section ul { padding-left: 16pt; }

  /* ── Appendix table ── */
  table.txn { width: 100%; border-collapse: collapse; font-size: 8pt; }
  table.txn th { background: #f2f2f2; font-weight: bold; padding: 4pt 6pt; text-align: left; border-bottom: 1pt solid #999; }
  table.txn th.r { text-align: right; }
  table.txn td { padding: 3pt 6pt; border-bottom: 0.3pt solid #e8e8e8; color: #333; }
  table.txn td.r { text-align: right; font-family: 'Courier New', monospace; }
  table.txn tr:nth-child(even) td { background: #fafafa; }

  /* ── Cash flow specific ── */
  .cf-section-header {
    font-size: 8.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1pt;
    background: #f5f5f5;
    padding: 5pt 8pt;
    margin: 12pt 0 4pt;
    border-left: 3pt solid #1B3A5C;
  }
  .cf-subtotal-label { font-style: italic; }

  @media print {
    .page { page-break-after: always; }
    body { -webkit-print-color-adjust: exact; }
  }
`;

// ─── COVER PAGE ───────────────────────────────────────────────────────────────

function coverPage(docType: string, businessName: string, meta: Record<string, string>): string {
  const metaRows = Object.entries(meta)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  return `
<div class="page cover">
  <div class="cover-brand">
    <div class="cover-logo"><span>FF</span></div>
    <span class="cover-brand-name">Financials Fast</span>
  </div>

  <hr class="cover-rule">

  <div class="cover-doc-type">${docType}</div>
  <div class="cover-title">${docType}</div>
  <div class="cover-business">${businessName}</div>

  <div class="cover-meta">
    <table>${metaRows}</table>
  </div>

  <div class="cover-spacer"></div>

  <div class="cover-footer">
    <p><strong>PREPARER DISCLOSURE:</strong> This statement is owner-prepared using AI-assisted analysis (Financials Fast, financialsfast.com). It has not been prepared, reviewed, compiled, or audited by a licensed Certified Public Accountant or accounting firm. The business owner certifies that the information provided is accurate and complete to the best of their knowledge. This document is intended for informational purposes and loan application support, and should be evaluated accordingly by the recipient.</p>
    <p style="margin-top:6pt;">This preparation method is equivalent in disclosure standard to owner-prepared statements generated using QuickBooks, Xero, Wave, or other accounting software. The use of AI-assisted classification does not diminish the owner's responsibility for the accuracy of the underlying data.</p>
  </div>
</div>`;
}

// ─── P&L TEMPLATE ─────────────────────────────────────────────────────────────

function buildPnLTemplate(data: Record<string, unknown>): string {
  const {
    businessName = 'Business', period = '12', reportingBasis = 'cash',
    revenue = {}, cogs = {}, opex = {},
    totalRevenue = 0, totalCOGS = 0, grossProfit = 0, grossMargin = 0,
    totalOpex = 0, netIncome = 0, netMargin = 0,
    transactionCount = 0, generatedAt = new Date().toISOString(),
    periodStart, periodEnd,
  } = data as Record<string, unknown>;

  const periodLabels: Record<string, string> = {
    '3': 'Three-Month Period', '6': 'Six-Month Period',
    '12': 'Twelve-Month Period (Annual)', 'ytd': 'Year-to-Date', 'custom': 'Selected Period',
  };
  const periodText = periodLabels[String(period)] || 'Selected Period';
  const basisText = reportingBasis === 'accrual' ? 'Accrual Basis' : 'Cash Basis';
  const preparedDate = today();
  const genDate = generatedAt ? new Date(String(generatedAt)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : preparedDate;

  const periodRange = periodStart && periodEnd
    ? `${new Date(String(periodStart)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${new Date(String(periodEnd)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : periodText;

  const itemRows = (obj: Record<string, number>, indent = true) =>
    Object.entries(obj)
      .filter(([, v]) => v !== 0)
      .map(([label, val]) => `
        <tr class="item">
          <td class="label">${label}</td>
          <td class="num">${fmt(val)}</td>
        </tr>`)
      .join('');

  const hasCOGS = Number(totalCOGS) > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${BASE_CSS}</style></head>
<body>

${coverPage('Profit &amp; Loss Statement', String(businessName), {
  'Reporting Period:': periodRange,
  'Accounting Basis:': basisText,
  'Prepared:': preparedDate,
  'Transactions Analyzed:': Number(transactionCount).toLocaleString(),
})}

<!-- P&L Statement -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <h1>Profit &amp; Loss Statement</h1>
      <div class="sub">${String(businessName)} &nbsp;·&nbsp; ${periodRange} &nbsp;·&nbsp; ${basisText}</div>
    </div>
    <div class="page-header-right">
      Prepared: ${preparedDate}<br>
      Transactions: ${Number(transactionCount).toLocaleString()}
    </div>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">${fmt(Number(totalRevenue))}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Gross Profit</div>
      <div class="metric-value">${fmt(Number(grossProfit))}</div>
      <div class="metric-sub">Margin: ${pct(Number(grossMargin))}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Net Income</div>
      <div class="metric-value">${fmt(Number(netIncome))}</div>
      <div class="metric-sub">Margin: ${pct(Number(netMargin))}</div>
    </div>
  </div>

  <!-- Revenue -->
  <div class="section-label">Revenue</div>
  <table class="fin">
    ${itemRows(revenue as Record<string, number>)}
    <tr class="subtotal">
      <td>Total Revenue</td>
      <td class="num">${fmt(Number(totalRevenue))}</td>
    </tr>
  </table>

  ${hasCOGS ? `
  <!-- Cost of Goods Sold -->
  <div class="section-label">Cost of Goods Sold</div>
  <table class="fin">
    ${itemRows(cogs as Record<string, number>)}
    <tr class="subtotal">
      <td>Total Cost of Goods Sold</td>
      <td class="num">${fmt(-Number(totalCOGS))}</td>
    </tr>
  </table>

  <table class="fin">
    <tr class="subtotal">
      <td>Gross Profit</td>
      <td class="num">${fmt(Number(grossProfit))}</td>
    </tr>
  </table>
  ` : ''}

  <!-- Operating Expenses -->
  <div class="section-label">Operating Expenses</div>
  <table class="fin">
    ${itemRows(opex as Record<string, number>)}
    <tr class="subtotal">
      <td>Total Operating Expenses</td>
      <td class="num">${fmt(-Number(totalOpex))}</td>
    </tr>
  </table>

  <!-- Net Income -->
  <table class="fin" style="margin-top:8pt;">
    <tr class="grand-total">
      <td>Net Income</td>
      <td class="num">${fmt(Number(netIncome))}</td>
    </tr>
  </table>
</div>

<!-- Notes & Assumptions -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <h1>Notes &amp; Assumptions</h1>
      <div class="sub">${String(businessName)} &nbsp;·&nbsp; Profit &amp; Loss Statement</div>
    </div>
    <div class="page-header-right">Prepared: ${preparedDate}</div>
  </div>

  <div class="notes-section">
    <h3>1. Basis of Preparation</h3>
    <p>This Profit &amp; Loss Statement was prepared on a <strong>${basisText.toLowerCase()}</strong>, recording revenue when cash is received and expenses when cash is disbursed. This is the most common basis for small business loan applications and is consistent with IRS Schedule C reporting.</p>
  </div>

  <div class="notes-section">
    <h3>2. Classification Methodology</h3>
    <ul>
      <li>Transactions were classified using a four-layer system: (1) owner-identified merchants from the business questionnaire, (2) known merchant pattern matching, (3) AI-assisted classification using transaction descriptions and amounts, and (4) owner review of flagged items.</li>
      <li>All classifications were informed by the business owner's responses describing their revenue sources, major vendors, payroll structure, and expense categories.</li>
      <li>Ambiguous transactions were flagged for owner confirmation before inclusion.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h3>3. Exclusions &amp; Adjustments</h3>
    <ul>
      <li>Owner draws, distributions, and personal expenses have been excluded from this statement.</li>
      <li>Inter-account transfers between the owner's business accounts have been eliminated to avoid double-counting.</li>
      <li>Non-business transactions identified by the owner have been excluded and are available in the appendix for reference.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h3>4. Significant Items</h3>
    <p>Any one-time or non-recurring items identified by the business owner during the questionnaire process are disclosed here. Lenders are encouraged to request clarification on any line items that appear unusual relative to the business's industry or size.</p>
  </div>

  <div class="notes-section">
    <h3>5. Owner Certification</h3>
    <p>The business owner certifies that to the best of their knowledge, this statement accurately represents the financial activity of the business for the period indicated. The owner acknowledges that this statement is owner-prepared and has not been reviewed or audited by a licensed CPA.</p>
  </div>

  <div class="notes-section">
    <h3>6. Contact Information</h3>
    <p>Questions regarding this statement should be directed to the business owner. This document was generated using Financials Fast (financialsfast.com).</p>
  </div>
</div>

</body>
</html>`;
}

// ─── BALANCE SHEET TEMPLATE ───────────────────────────────────────────────────

function buildBalanceSheetTemplate(data: Record<string, unknown>): string {
  const {
    businessName = 'Business',
    statementDate = today(),
    entityType = 'Business',
    // Current assets
    totalCash = 0, totalReceivables = 0, inventoryValue = 0,
    prepaidExpenses = 0, otherCurrentAssets = 0,
    // Non-current assets
    equipmentNet = 0, realEstateNet = 0, intangibles = 0,
    securityDeposits = 0, otherLongTermAssets = 0,
    // Current liabilities
    accountsPayable = 0, shortTermDebt = 0, accruedLiabilities = 0,
    deferredRevenue = 0, otherCurrentLiabilities = 0,
    // Long-term liabilities
    longTermDebt = 0, leaseObligations = 0, otherLongTermLiabilities = 0,
    // Equity
    retainedEarnings = 0, ownerEquity = 0, additionalPaidIn = 0,
  } = data as Record<string, unknown>;

  const stateDateStr = new Date(String(statementDate)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate totals
  const totalCurrentAssets = Number(totalCash) + Number(totalReceivables) + Number(inventoryValue) + Number(prepaidExpenses) + Number(otherCurrentAssets);
  const totalNonCurrentAssets = Number(equipmentNet) + Number(realEstateNet) + Number(intangibles) + Number(securityDeposits) + Number(otherLongTermAssets);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const totalCurrentLiabilities = Number(accountsPayable) + Number(shortTermDebt) + Number(accruedLiabilities) + Number(deferredRevenue) + Number(otherCurrentLiabilities);
  const totalLongTermLiabilities = Number(longTermDebt) + Number(leaseObligations) + Number(otherLongTermLiabilities);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  const totalEquity = Number(retainedEarnings) + Number(ownerEquity) + Number(additionalPaidIn);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const row = (label: string, val: number, indent = true) => val === 0 ? '' : `
    <tr class="item">
      <td class="${indent ? 'label' : ''}">${label}</td>
      <td class="num">${fmt(val)}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${BASE_CSS}</style></head>
<body>

${coverPage('Balance Sheet', String(businessName), {
  'As of Date:': stateDateStr,
  'Entity Type:': String(entityType),
  'Accounting Basis:': 'Historical Cost (GAAP)',
  'Prepared:': today(),
})}

<!-- Balance Sheet -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <h1>Balance Sheet</h1>
      <div class="sub">${String(businessName)} &nbsp;·&nbsp; As of ${stateDateStr} &nbsp;·&nbsp; ${String(entityType)}</div>
    </div>
    <div class="page-header-right">Prepared: ${today()}</div>
  </div>

  <div style="display:flex; gap:32pt;">

    <!-- ASSETS COLUMN -->
    <div style="flex:1;">
      <div class="section-label">Assets</div>

      <div style="font-size:9pt; font-weight:bold; margin:10pt 0 4pt; color:#333;">Current Assets</div>
      <table class="fin">
        ${row('Cash &amp; cash equivalents', Number(totalCash))}
        ${row('Accounts receivable', Number(totalReceivables))}
        ${row('Inventory', Number(inventoryValue))}
        ${row('Prepaid expenses', Number(prepaidExpenses))}
        ${row('Other current assets', Number(otherCurrentAssets))}
        <tr class="subtotal">
          <td>Total Current Assets</td>
          <td class="num">${fmt(totalCurrentAssets)}</td>
        </tr>
      </table>

      <div style="font-size:9pt; font-weight:bold; margin:12pt 0 4pt; color:#333;">Non-Current Assets</div>
      <table class="fin">
        ${row('Property, plant &amp; equipment (net)', Number(equipmentNet))}
        ${row('Real estate (net)', Number(realEstateNet))}
        ${row('Intangible assets', Number(intangibles))}
        ${row('Security deposits', Number(securityDeposits))}
        ${row('Other long-term assets', Number(otherLongTermAssets))}
        <tr class="subtotal">
          <td>Total Non-Current Assets</td>
          <td class="num">${fmt(totalNonCurrentAssets)}</td>
        </tr>
      </table>

      <table class="fin" style="margin-top:8pt;">
        <tr class="grand-total">
          <td>Total Assets</td>
          <td class="num">${fmt(totalAssets)}</td>
        </tr>
      </table>
    </div>

    <!-- LIABILITIES & EQUITY COLUMN -->
    <div style="flex:1; border-left:0.5pt solid #ccc; padding-left:24pt;">
      <div class="section-label">Liabilities &amp; Equity</div>

      <div style="font-size:9pt; font-weight:bold; margin:10pt 0 4pt; color:#333;">Current Liabilities</div>
      <table class="fin">
        ${row('Accounts payable', Number(accountsPayable))}
        ${row('Short-term debt', Number(shortTermDebt))}
        ${row('Accrued liabilities', Number(accruedLiabilities))}
        ${row('Deferred revenue', Number(deferredRevenue))}
        ${row('Other current liabilities', Number(otherCurrentLiabilities))}
        <tr class="subtotal">
          <td>Total Current Liabilities</td>
          <td class="num">${fmt(totalCurrentLiabilities)}</td>
        </tr>
      </table>

      <div style="font-size:9pt; font-weight:bold; margin:12pt 0 4pt; color:#333;">Long-Term Liabilities</div>
      <table class="fin">
        ${row('Long-term debt', Number(longTermDebt))}
        ${row('Lease obligations (ASC 842)', Number(leaseObligations))}
        ${row('Other long-term liabilities', Number(otherLongTermLiabilities))}
        <tr class="subtotal">
          <td>Total Long-Term Liabilities</td>
          <td class="num">${fmt(totalLongTermLiabilities)}</td>
        </tr>
      </table>

      <table class="fin" style="margin-top:6pt;">
        <tr class="subtotal">
          <td>Total Liabilities</td>
          <td class="num">${fmt(totalLiabilities)}</td>
        </tr>
      </table>

      <div style="font-size:9pt; font-weight:bold; margin:12pt 0 4pt; color:#333;">${String(entityType).includes('Corp') ? "Stockholders' Equity" : "Owner's Equity"}</div>
      <table class="fin">
        ${String(entityType).includes('Corp') ? row('Common stock &amp; APIC', Number(additionalPaidIn)) : ''}
        ${row(String(entityType).includes('Sole') ? "Owner's capital" : 'Retained earnings / member equity', Number(retainedEarnings))}
        ${row(String(entityType).includes('Corp') ? 'Net income (current period)' : 'Current period earnings', Number(ownerEquity))}
        <tr class="subtotal">
          <td>Total Equity</td>
          <td class="num">${fmt(totalEquity)}</td>
        </tr>
      </table>

      <table class="fin" style="margin-top:8pt;">
        <tr class="grand-total">
          <td>Total Liabilities &amp; Equity</td>
          <td class="num">${fmt(totalLiabilitiesAndEquity)}</td>
        </tr>
      </table>

      ${Math.abs(totalAssets - totalLiabilitiesAndEquity) > 1 ? `
      <p style="font-size:8pt; color:#c00; margin-top:8pt;">
        ⚠ Note: Assets (${fmt(totalAssets)}) do not equal Liabilities + Equity (${fmt(totalLiabilitiesAndEquity)}). 
        Difference of ${fmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))} — please review input data.
      </p>` : `
      <p style="font-size:8pt; color:#2a7a2a; margin-top:8pt;">
        ✓ Balance sheet is in balance. Assets = Liabilities + Equity.
      </p>`}
    </div>

  </div>
</div>

<!-- Notes -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <h1>Notes to Financial Statements</h1>
      <div class="sub">${String(businessName)} &nbsp;·&nbsp; Balance Sheet as of ${stateDateStr}</div>
    </div>
    <div class="page-header-right">Prepared: ${today()}</div>
  </div>

  <div class="notes-section">
    <h3>1. Basis of Presentation</h3>
    <p>This balance sheet has been prepared in conformity with generally accepted accounting principles (GAAP) applicable to small businesses, specifically ASC 210 (Balance Sheet). Assets and liabilities are classified as current (due within 12 months) and non-current.</p>
  </div>

  <div class="notes-section">
    <h3>2. Significant Accounting Policies</h3>
    <ul>
      <li><strong>Cash and cash equivalents:</strong> Includes all bank accounts and instruments with original maturities of three months or less.</li>
      <li><strong>Accounts receivable:</strong> Stated at net realizable value. An allowance for doubtful accounts has been applied where indicated by the owner.</li>
      <li><strong>Inventory:</strong> Valued using the method indicated by the owner (FIFO, LIFO, or weighted average cost), consistent with prior periods.</li>
      <li><strong>Property, plant &amp; equipment:</strong> Recorded at historical cost less accumulated depreciation. Depreciation is calculated using the method and useful lives provided by the owner.</li>
      <li><strong>Leases:</strong> Right-of-use assets and lease liabilities for leases with terms exceeding 12 months are recognized per ASC 842.</li>
    </ul>
  </div>

  <div class="notes-section">
    <h3>3. Owner Certification</h3>
    <p>The business owner certifies that the balances presented reflect the financial position of the business as of the statement date to the best of their knowledge. This statement is owner-prepared and has not been reviewed or audited by a licensed CPA.</p>
  </div>
</div>

</body>
</html>`;
}

// ─── CASH FLOW TEMPLATE ───────────────────────────────────────────────────────

function buildCashFlowTemplate(data: Record<string, unknown>): string {
  const {
    businessName = 'Business',
    projectionPeriodMonths = 12,
    projectionStartDate = '',
    projectionBasis = 'base',
    presentationFrequency = 'monthly',
    currentCashBalance = 0,
    lenderName = '',
    // Revenue
    baselineMonthlyRevenue = 0,
    revenueGrowthRate = 0,
    revenueGrowthRatePeriod = 'annual',
    // Fixed expenses
    monthlyRent = 0,
    monthlyPayroll = 0,
    monthlyInsurance = 0,
    monthlySubscriptions = 0,
    monthlyLoanPayments = 0,
    otherFixedExpenses = 0,
    // Variable %
    cogsPercent = 0,
    salesMarketingPercent = 0,
    otherVariablePercent = 0,
    // Owner draws
    ownerDistributionsPlanned = 0,
    // Depreciation (non-cash add-back)
    monthlyDepreciation = 0,
    // Assumptions
    keyAssumptions = '',
    biggestRisks = '',
    minimumCashBuffer = 0,
    includeScenarioAnalysis = false,
  } = data as Record<string, unknown>;

  const months = Number(projectionPeriodMonths);
  const baseline = Number(baselineMonthlyRevenue);
  const growthRate = Number(revenueGrowthRate);
  const monthlyGrowth = revenueGrowthRatePeriod === 'monthly'
    ? growthRate / 100
    : Math.pow(1 + growthRate / 100, 1 / 12) - 1;

  const fixedTotal = Number(monthlyRent) + Number(monthlyPayroll) + Number(monthlyInsurance)
    + Number(monthlySubscriptions) + Number(monthlyLoanPayments) + Number(otherFixedExpenses);
  const variablePct = (Number(cogsPercent) + Number(salesMarketingPercent) + Number(otherVariablePercent)) / 100;
  const depr = Number(monthlyDepreciation);
  const draws = Number(ownerDistributionsPlanned);

  // Build monthly projection rows
  type MonthData = {
    month: number;
    revenue: number;
    variableExpenses: number;
    fixedExpenses: number;
    operatingCF: number;
    financingCF: number;
    netCF: number;
    endingCash: number;
    belowBuffer: boolean;
  };

  const monthlyData: MonthData[] = [];
  let cash = Number(currentCashBalance);
  const buffer = Number(minimumCashBuffer);
  const startDate = projectionStartDate ? new Date(String(projectionStartDate)) : new Date();

  for (let m = 1; m <= months; m++) {
    const revenue = baseline * Math.pow(1 + monthlyGrowth, m - 1);
    const variableExp = revenue * variablePct;
    // Operating: revenue - variable costs - fixed costs + depreciation add-back
    const operatingCF = revenue - variableExp - fixedTotal + depr;
    const financingCF = -draws;
    const netCF = operatingCF + financingCF;
    cash += netCF;

    monthlyData.push({
      month: m,
      revenue: Math.round(revenue),
      variableExpenses: Math.round(variableExp),
      fixedExpenses: Math.round(fixedTotal),
      operatingCF: Math.round(operatingCF),
      financingCF: Math.round(financingCF),
      netCF: Math.round(netCF),
      endingCash: Math.round(cash),
      belowBuffer: cash < buffer,
    });
  }

  const isQuarterly = presentationFrequency === 'quarterly';
  const displayData = isQuarterly
    ? [0, 1, 2, 3].map((q) => {
        const slice = monthlyData.slice(q * 3, q * 3 + 3).filter(Boolean);
        if (!slice.length) return null;
        return {
          label: `Q${q + 1}`,
          revenue: slice.reduce((s, r) => s + r.revenue, 0),
          variableExpenses: slice.reduce((s, r) => s + r.variableExpenses, 0),
          fixedExpenses: slice.reduce((s, r) => s + r.fixedExpenses, 0),
          operatingCF: slice.reduce((s, r) => s + r.operatingCF, 0),
          financingCF: slice.reduce((s, r) => s + r.financingCF, 0),
          netCF: slice.reduce((s, r) => s + r.netCF, 0),
          endingCash: slice[slice.length - 1].endingCash,
          belowBuffer: slice.some((r) => r.belowBuffer),
        };
      }).filter(Boolean)
    : monthlyData.slice(0, 12); // show max 12 cols per page

  const totalRevenue = monthlyData.reduce((s, r) => s + r.revenue, 0);
  const totalOpCF = monthlyData.reduce((s, r) => s + r.operatingCF, 0);
  const totalFinCF = monthlyData.reduce((s, r) => s + r.financingCF, 0);
  const totalNetCF = monthlyData.reduce((s, r) => s + r.netCF, 0);
  const endingCash = monthlyData[monthlyData.length - 1]?.endingCash ?? 0;

  const basisLabel: Record<string, string> = {
    'conservative': 'Conservative Case',
    'base': 'Base Case',
    'optimistic': 'Optimistic Case',
  };

  const colHeaders = displayData.map((d) => {
    if (!d) return '';
    if ('month' in d) {
      const dt = new Date(startDate);
      dt.setMonth(dt.getMonth() + (d as MonthData).month - 1);
      return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return (d as { label: string }).label;
  });

  const tableRow = (label: string, key: keyof MonthData | string, negate = false, isTotal = false, style = '') => {
    const vals = displayData.map((d) => {
      if (!d) return '';
      const v = (d as Record<string, unknown>)[key] as number ?? 0;
      const n = negate ? -v : v;
      const color = (d as { belowBuffer?: boolean }).belowBuffer && key === 'endingCash' ? 'color:#c00;' : '';
      return `<td class="r" style="font-family:'Courier New',monospace;font-size:8.5pt;${color}">${fmt(n)}</td>`;
    }).join('');

    const rowStyle = isTotal
      ? 'border-top:0.75pt solid #111; border-bottom:1.5pt double #111; font-weight:bold;'
      : style;

    return `<tr style="${rowStyle}"><td style="padding:2.5pt 4pt; font-size:8.5pt;">${label}</td>${vals}</tr>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  ${BASE_CSS}
  .cf-table { width:100%; border-collapse:collapse; font-size:8.5pt; }
  .cf-table th { background:#f0f0f0; font-size:8pt; font-weight:bold; text-align:right; padding:4pt 4pt; border-bottom:1pt solid #999; }
  .cf-table th:first-child { text-align:left; }
  .cf-table td { padding:2.5pt 4pt; border-bottom:0.2pt solid #e8e8e8; }
  .cf-table td.r { text-align:right; }
  .cf-section-row td { background:#f5f5f5; font-weight:bold; font-size:8pt; text-transform:uppercase; letter-spacing:0.5pt; padding:5pt 4pt; border-top:1pt solid #ccc; border-bottom:0.5pt solid #bbb; }
</style></head>
<body>

${coverPage('Cash Flow Projection', String(businessName), {
  'Projection Period:': `${months} Months`,
  'Starting:': projectionStartDate ? new Date(String(projectionStartDate)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : today(),
  'Scenario:': basisLabel[String(projectionBasis)] || 'Base Case',
  'Method:': 'Indirect Method (ASC 230)',
  'Beginning Cash:': fmt(Number(currentCashBalance)),
  'Prepared For:': String(lenderName) || 'Lender Review',
  'Prepared:': today(),
})}

<!-- Projection Table -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <h1>Cash Flow Projection</h1>
      <div class="sub">${String(businessName)} &nbsp;·&nbsp; ${months}-Month ${basisLabel[String(projectionBasis)] || 'Base Case'} &nbsp;·&nbsp; Indirect Method (ASC 230)</div>
    </div>
    <div class="page-header-right">Prepared: ${today()}</div>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Beginning Cash</div>
      <div class="metric-value">${fmt(Number(currentCashBalance))}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total Operating CF</div>
      <div class="metric-value">${fmt(totalOpCF)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Net Change in Cash</div>
      <div class="metric-value">${fmt(totalNetCF)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Ending Cash (Proj.)</div>
      <div class="metric-value" style="${endingCash < 0 ? 'color:#c00;' : ''}">${fmt(endingCash)}</div>
    </div>
  </div>

  <table class="cf-table">
    <thead>
      <tr>
        <th style="width:160pt;">Category</th>
        ${colHeaders.map((h) => `<th>${h}</th>`).join('')}
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <!-- Operating Activities -->
      <tr class="cf-section-row"><td colspan="${displayData.length + 2}">Section 1 — Operating Activities</td></tr>
      ${tableRow('Revenue (projected)', 'revenue')}
      ${tableRow('Variable expenses', 'variableExpenses', true)}
      ${tableRow('Fixed operating expenses', 'fixedExpenses', true)}
      <tr><td style="padding:2.5pt 4pt; font-size:8.5pt; padding-left:12pt; color:#666; font-style:italic;">+ Depreciation add-back (non-cash)</td>
        ${displayData.map(() => `<td class="r" style="font-style:italic;color:#666;font-size:8.5pt;">${fmt(depr)}</td>`).join('')}
        <td class="r" style="font-style:italic;color:#666;font-size:8.5pt;">${fmt(depr * months)}</td>
      </tr>
      <tr style="border-top:0.75pt solid #111; font-weight:bold;">
        <td style="padding:4pt;">Net Cash from Operations</td>
        ${displayData.map((d) => `<td class="r" style="font-weight:bold;">${fmt((d as MonthData | {operatingCF:number}).operatingCF)}</td>`).join('')}
        <td class="r" style="font-weight:bold;">${fmt(totalOpCF)}</td>
      </tr>

      <!-- Financing Activities -->
      <tr class="cf-section-row"><td colspan="${displayData.length + 2}">Section 3 — Financing Activities</td></tr>
      <tr>
        <td style="padding:2.5pt 4pt;">Owner distributions / draws</td>
        ${displayData.map(() => `<td class="r">${fmt(-draws)}</td>`).join('')}
        <td class="r">${fmt(-draws * months)}</td>
      </tr>
      <tr style="border-top:0.75pt solid #111; font-weight:bold;">
        <td style="padding:4pt;">Net Cash from Financing</td>
        ${displayData.map(() => `<td class="r" style="font-weight:bold;">${fmt(-draws)}</td>`).join('')}
        <td class="r" style="font-weight:bold;">${fmt(totalFinCF)}</td>
      </tr>

      <!-- Net Change & Running Balance -->
      <tr class="cf-section-row"><td colspan="${displayData.length + 2}">Net Change &amp; Cash Balance</td></tr>
      <tr style="font-weight:bold; border-top:0.5pt solid #999;">
        <td style="padding:4pt;">Net Change in Cash</td>
        ${displayData.map((d) => `<td class="r" style="font-weight:bold;">${fmt((d as MonthData | {netCF:number}).netCF)}</td>`).join('')}
        <td class="r" style="font-weight:bold;">${fmt(totalNetCF)}</td>
      </tr>
      <tr style="border-top:0.75pt solid #111; border-bottom:2.5pt double #111; font-weight:bold; font-size:9.5pt;">
        <td style="padding:5pt 4pt;">Ending Cash Balance</td>
        ${displayData.map((d) => {
          const ec = (d as MonthData | {endingCash:number}).endingCash;
          const bb = (d as {belowBuffer?:boolean}).belowBuffer;
          return `<td class="r" style="font-weight:bold;${bb ? 'color:#c00;' : ''}">${fmt(ec)}</td>`;
        }).join('')}
        <td class="r" style="font-weight:bold;">${fmt(endingCash)}</td>
      </tr>
    </tbody>
  </table>

  ${buffer > 0 ? `<p style="font-size:8pt; color:#c00; margin-top:8pt;">⚠ Months shown in red have cash below the minimum buffer of ${fmt(buffer)}.</p>` : ''}
</div>

<!-- Assumptions Page -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      <h1>Key Assumptions &amp; Methodology</h1>
      <div class="sub">${String(businessName)} &nbsp;·&nbsp; ${months}-Month Cash Flow Projection</div>
    </div>
    <div class="page-header-right">Prepared: ${today()}</div>
  </div>

  <div class="notes-section">
    <h3>1. Projection Methodology</h3>
    <p>This cash flow projection is prepared using the <strong>indirect method</strong> as prescribed by ASC 230 (Statement of Cash Flows). Under the indirect method, net income is adjusted for non-cash items (depreciation) and changes in working capital to arrive at operating cash flow. Investing and financing activities are presented separately.</p>
    <p style="margin-top:6pt;">This is a <strong>${basisLabel[String(projectionBasis)] || 'Base Case'}</strong> projection. All assumptions are documented below and should be reviewed by the lender in the context of the business's historical performance.</p>
  </div>

  <div class="notes-section">
    <h3>2. Revenue Assumptions</h3>
    <ul>
      <li>Baseline monthly revenue: <strong>${fmt(baseline)}</strong> (based on recent operating history)</li>
      <li>Growth rate applied: <strong>${growthRate}% ${revenueGrowthRatePeriod === 'monthly' ? 'per month' : 'per year'}</strong> (compounded ${revenueGrowthRatePeriod === 'monthly' ? 'monthly' : 'monthly equivalent'})</li>
      <li>Total projected revenue over ${months} months: <strong>${fmt(totalRevenue)}</strong></li>
      ${String(keyAssumptions) ? `<li>Additional owner assumptions: ${String(keyAssumptions)}</li>` : ''}
    </ul>
  </div>

  <div class="notes-section">
    <h3>3. Expense Assumptions</h3>
    <ul>
      <li>Fixed monthly expenses: <strong>${fmt(fixedTotal)}</strong> (rent: ${fmt(Number(monthlyRent))}, payroll: ${fmt(Number(monthlyPayroll))}, insurance: ${fmt(Number(monthlyInsurance))}, subscriptions: ${fmt(Number(monthlySubscriptions))}, loan payments: ${fmt(Number(monthlyLoanPayments))}, other: ${fmt(Number(otherFixedExpenses))})</li>
      <li>Variable expenses: <strong>${(variablePct * 100).toFixed(1)}% of revenue</strong> (COGS: ${cogsPercent}%, sales/marketing: ${salesMarketingPercent}%, other: ${otherVariablePercent}%)</li>
      <li>Monthly depreciation add-back: <strong>${fmt(depr)}</strong> (non-cash, added back to net income per indirect method)</li>
      <li>Owner distributions: <strong>${fmt(draws)}/month</strong> (financing activity)</li>
    </ul>
  </div>

  ${String(biggestRisks) ? `
  <div class="notes-section">
    <h3>4. Key Risks &amp; Sensitivities</h3>
    <p>${String(biggestRisks)}</p>
  </div>` : ''}

  <div class="notes-section">
    <h3>${String(biggestRisks) ? '5' : '4'}. Owner Certification</h3>
    <p>The business owner certifies that the assumptions underlying this projection represent their best estimate of future operating conditions based on current business performance, known commitments, and planned activities. Actual results will vary. This projection is owner-prepared and has not been reviewed or audited by a licensed CPA.</p>
  </div>

  ${includeScenarioAnalysis ? `
  <div class="notes-section">
    <h3>Scenario Analysis Summary</h3>
    <table class="fin" style="margin-top:8pt;">
      <tr style="background:#f5f5f5; font-weight:bold; border-bottom:1pt solid #999;">
        <td style="padding:4pt;">Scenario</td>
        <td style="padding:4pt;">Revenue Assumption</td>
        <td class="num">Proj. Ending Cash</td>
      </tr>
      <tr class="item"><td class="label">Conservative (−20% revenue)</td><td style="font-size:9pt; color:#555;">${fmt(baseline * 0.8)}/mo baseline</td><td class="num">${fmt(endingCash - totalRevenue * 0.2)}</td></tr>
      <tr class="item"><td class="label">Base Case (as presented)</td><td style="font-size:9pt; color:#555;">${fmt(baseline)}/mo baseline</td><td class="num">${fmt(endingCash)}</td></tr>
      <tr class="item"><td class="label">Optimistic (+20% revenue)</td><td style="font-size:9pt; color:#555;">${fmt(baseline * 1.2)}/mo baseline</td><td class="num">${fmt(endingCash + totalRevenue * 0.2)}</td></tr>
    </table>
  </div>` : ''}
</div>

</body>
</html>`;
}

// ─── Main API handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pnlData, balanceSheetData, cashFlowData, documentType = 'pnl' } = body as {
      pnlData?: Record<string, unknown>;
      balanceSheetData?: Record<string, unknown>;
      cashFlowData?: Record<string, unknown>;
      documentType?: 'pnl' | 'balance-sheet' | 'cashflow';
    };

    // Select the right template
    let html: string;
    let filename: string;

    switch (documentType) {
      case 'balance-sheet':
        if (!balanceSheetData) return NextResponse.json({ error: 'Balance sheet data required' }, { status: 400 });
        html = buildBalanceSheetTemplate(balanceSheetData);
        filename = `${String(balanceSheetData.businessName || 'Business').replace(/\s+/g, '-')}-Balance-Sheet.pdf`;
        break;
      case 'cashflow':
        if (!cashFlowData) return NextResponse.json({ error: 'Cash flow data required' }, { status: 400 });
        html = buildCashFlowTemplate(cashFlowData);
        filename = `${String(cashFlowData.businessName || 'Business').replace(/\s+/g, '-')}-Cash-Flow-Projection.pdf`;
        break;
      default:
        if (!pnlData) return NextResponse.json({ error: 'P&L data required' }, { status: 400 });
        html = buildPnLTemplate(pnlData);
        filename = `${String(pnlData.businessName || 'Business').replace(/\s+/g, '-')}-PnL-Statement.pdf`;
    }

    // Attempt Puppeteer PDF generation
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
    } catch (puppeteerError) {
      console.warn('Puppeteer unavailable, returning HTML fallback:', puppeteerError);
    }

    // Fallback: return HTML for client-side print-to-PDF
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-PDF-Fallback': 'true',
        'X-Filename': filename,
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
