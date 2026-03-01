import { NextRequest, NextResponse } from 'next/server';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function buildHTMLTemplate(pnlData: Record<string, unknown>): string {
  const {
    businessName, period, reportingBasis, revenue, cogs, opex,
    totalRevenue, totalCOGS, grossProfit, grossMargin,
    totalOpex, netIncome, netMargin, transactionCount, generatedAt,
  } = pnlData as {
    businessName: string; period: string; reportingBasis: string;
    revenue: Record<string, number>; cogs: Record<string, number>; opex: Record<string, number>;
    totalRevenue: number; totalCOGS: number; grossProfit: number; grossMargin: number;
    totalOpex: number; netIncome: number; netMargin: number;
    transactionCount: number; generatedAt: string;
  };

  const periodLabel: Record<string, string> = {
    '3': '3-Month', '6': '6-Month', '12': '12-Month (Annual)', 'ytd': 'Year-to-Date',
  };
  const periodText = periodLabel[period] || 'Selected Period';
  const today = new Date(generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const lineRow = (label: string, value: number, indent = false, bold = false, negative = false) => {
    const displayValue = negative && value > 0
      ? `(${formatCurrency(value)})`
      : formatCurrency(Math.abs(value));
    return `
      <tr class="${bold ? 'bold-row' : ''} ${indent ? 'indent' : ''}">
        <td class="line-label">${label}</td>
        <td class="line-value ${value < 0 ? 'negative' : ''}">${displayValue}</td>
      </tr>`;
  };

  const sectionRows = (items: Record<string, number>, negative = false) =>
    Object.entries(items)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => lineRow(k, v, true, false, negative))
      .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #1a1a2e; background: white; }
  .page { width: 8.5in; min-height: 11in; padding: 0.75in 1in; }

  /* Cover */
  .cover { display: flex; flex-direction: column; height: 10.5in; }
  .cover-header { display: flex; align-items: center; gap: 12px; margin-bottom: 2in; }
  .logo-box { width: 40px; height: 40px; background: #1B3A5C; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
  .logo-text { color: #C9A84C; font-weight: bold; font-size: 14px; font-family: Arial; }
  .brand { font-family: Arial; font-size: 14pt; font-weight: bold; color: #1B3A5C; }
  .cover-title { margin-top: auto; }
  .cover-title h1 { font-size: 32pt; color: #1B3A5C; line-height: 1.1; margin-bottom: 16px; }
  .cover-title h2 { font-size: 18pt; color: #C9A84C; margin-bottom: 24px; }
  .cover-meta { font-size: 10pt; color: #666; line-height: 2; margin-top: 24px; }
  .cover-footer { margin-top: auto; padding-top: 24px; border-top: 2px solid #C9A84C; font-size: 9pt; color: #888; }

  /* P&L Page */
  .section-title { font-size: 9pt; font-weight: bold; color: #1B3A5C; letter-spacing: 1px; text-transform: uppercase; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #f0f0f0; }
  td { padding: 5px 0; }
  .line-label { color: #333; }
  .line-value { text-align: right; font-family: 'Courier New', monospace; font-size: 10.5pt; }
  .indent .line-label { padding-left: 20px; font-size: 10pt; color: #555; }
  .bold-row { border-bottom: 2px solid #1B3A5C; }
  .bold-row td { font-weight: bold; font-size: 11.5pt; padding: 8px 0; }
  .negative { color: #c0392b; }
  .total-row { background: #f8f9fa; }
  .total-row td { font-weight: bold; font-size: 13pt; padding: 12px 0; color: #1B3A5C; }
  .net-negative { color: #c0392b !important; }
  .metrics { display: flex; gap: 20px; margin: 20px 0; }
  .metric { flex: 1; background: #f8f9fa; border-left: 4px solid #C9A84C; padding: 12px; }
  .metric-label { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-value { font-size: 16pt; font-weight: bold; color: #1B3A5C; margin-top: 4px; }
  .notes { margin-top: 32px; padding: 16px; background: #f8f9fa; border-left: 4px solid #1B3A5C; }
  .notes h3 { font-size: 10pt; color: #1B3A5C; margin-bottom: 8px; }
  .notes p { font-size: 9pt; color: #555; line-height: 1.6; margin-bottom: 6px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1B3A5C; padding-bottom: 16px; }
  .page-header h1 { font-size: 20pt; color: #1B3A5C; }
  .page-header .sub { font-size: 10pt; color: #666; margin-top: 4px; }
  .page-header .date { font-size: 9pt; color: #888; text-align: right; }
  @media print { .page { page-break-after: always; } }
</style>
</head>
<body>

<!-- Cover Page -->
<div class="page cover">
  <div class="cover-header">
    <div class="logo-box"><span class="logo-text">FF</span></div>
    <span class="brand">Financials Fast</span>
  </div>
  <div class="cover-title">
    <h1>Profit &amp; Loss Statement</h1>
    <h2>${businessName}</h2>
    <div class="cover-meta">
      <div><strong>Reporting Period:</strong> ${periodText}</div>
      <div><strong>Accounting Basis:</strong> ${reportingBasis === 'cash' ? 'Cash Basis' : 'Accrual Basis'}</div>
      <div><strong>Prepared:</strong> ${today}</div>
      <div><strong>Transactions Analyzed:</strong> ${transactionCount?.toLocaleString() || '—'}</div>
    </div>
  </div>
  <div class="cover-footer">
    <p><strong>IMPORTANT NOTICE:</strong> This statement is owner-prepared and AI-assisted. It is not prepared, reviewed, or audited by a licensed CPA or accounting firm. This document should be used for informational purposes and loan application support only. The business owner is responsible for the accuracy of all information provided.</p>
    <p style="margin-top:8px">Generated by Financials Fast (financialsfast.com) · For questions, contact the business owner directly.</p>
  </div>
</div>

<!-- P&L Statement Page -->
<div class="page">
  <div class="page-header">
    <div>
      <h1>Profit &amp; Loss</h1>
      <div class="sub">${businessName} · ${periodText} · ${reportingBasis === 'cash' ? 'Cash Basis' : 'Accrual Basis'}</div>
    </div>
    <div class="date">Prepared: ${today}<br>Transactions: ${transactionCount?.toLocaleString() || '—'}</div>
  </div>

  <!-- Key Metrics -->
  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">${formatCurrency(totalRevenue)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Gross Margin</div>
      <div class="metric-value">${grossMargin.toFixed(1)}%</div>
    </div>
    <div class="metric">
      <div class="metric-label">Net Income</div>
      <div class="metric-value ${netIncome < 0 ? 'net-negative' : ''}">${formatCurrency(netIncome)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Net Margin</div>
      <div class="metric-value ${netMargin < 0 ? 'net-negative' : ''}">${netMargin.toFixed(1)}%</div>
    </div>
  </div>

  <!-- Revenue -->
  <div class="section-title">Revenue</div>
  <table>
    ${sectionRows(revenue)}
    ${lineRow('Total Revenue', totalRevenue, false, true)}
  </table>

  <!-- COGS -->
  ${totalCOGS > 0 ? `
  <div class="section-title">Cost of Goods Sold</div>
  <table>
    ${sectionRows(cogs, true)}
    ${lineRow('Total Cost of Goods Sold', totalCOGS, false, true, true)}
  </table>
  ` : ''}

  <!-- Gross Profit -->
  <table>
    <tr class="total-row">
      <td>Gross Profit</td>
      <td class="line-value ${grossProfit < 0 ? 'net-negative' : ''}">${formatCurrency(grossProfit)}</td>
    </tr>
  </table>

  <!-- Operating Expenses -->
  <div class="section-title">Operating Expenses</div>
  <table>
    ${sectionRows(opex, true)}
    ${lineRow('Total Operating Expenses', totalOpex, false, true, true)}
  </table>

  <!-- Net Income -->
  <table>
    <tr class="total-row">
      <td>Net Income</td>
      <td class="line-value ${netIncome < 0 ? 'net-negative' : ''}">${formatCurrency(netIncome)}</td>
    </tr>
  </table>

  <!-- Notes -->
  <div class="notes">
    <h3>Notes &amp; Assumptions</h3>
    <p>• This statement is prepared on a <strong>${reportingBasis === 'cash' ? 'cash basis' : 'accrual basis'}</strong>, recording transactions when cash is received or disbursed.</p>
    <p>• Transactions were classified using AI-assisted analysis informed by business owner questionnaire responses. Confidence thresholds were applied to route uncertain transactions for review.</p>
    <p>• Owner draws and personal expenses are excluded from this statement. Mixed personal/business transactions were separated based on owner-provided guidance.</p>
    <p>• This statement covers ${periodText.toLowerCase()} of business activity based on ${transactionCount?.toLocaleString() || 'analyzed'} bank transactions.</p>
    <p>• This document has not been reviewed or audited by a licensed CPA. For tax filing purposes, consult a qualified tax professional.</p>
  </div>
</div>

</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { pnlData } = await req.json();

    if (!pnlData) {
      return NextResponse.json({ error: 'P&L data required' }, { status: 400 });
    }

    const html = buildHTMLTemplate(pnlData);

    // Try to use Puppeteer for PDF generation
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

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${(pnlData as { businessName?: string }).businessName || 'PnL'}-Statement.pdf"`,
            'Cache-Control': 'no-store',
          },
        });
      }
    } catch (puppeteerError) {
      console.warn('Puppeteer unavailable, returning HTML:', puppeteerError);
    }

    // Fallback: return the HTML for client-side printing
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-PDF-Fallback': 'true',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
