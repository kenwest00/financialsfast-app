import { NextRequest, NextResponse } from 'next/server';

// QuickBooks API — Pull P&L and Balance Sheet reports
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/profitandloss
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/balancesheet

// Use sandbox URL for development, production URL for live
const QB_API_BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('qb_access_token')?.value;
  const realmId = req.cookies.get('qb_realm_id')?.value;

  if (!accessToken || !realmId) {
    return NextResponse.json(
      { error: 'QuickBooks not connected. Please connect your account first.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { startDate, endDate } = body as {
      startDate?: string; // YYYY-MM-DD
      endDate?: string;   // YYYY-MM-DD
    };

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Build date params
    const dateParams = new URLSearchParams();
    if (startDate) dateParams.set('start_date', startDate);
    if (endDate) dateParams.set('end_date', endDate);
    const dateQuery = dateParams.toString() ? `?${dateParams.toString()}` : '';

    // Fetch P&L and Balance Sheet in parallel
    const [pnlResponse, bsResponse, companyResponse] = await Promise.all([
      fetch(
        `${QB_API_BASE}/v3/company/${realmId}/reports/ProfitAndLoss${dateQuery}`,
        { headers }
      ),
      fetch(
        `${QB_API_BASE}/v3/company/${realmId}/reports/BalanceSheet${dateQuery ? `?as_of_date=${endDate || ''}` : ''}`,
        { headers }
      ),
      fetch(
        `${QB_API_BASE}/v3/company/${realmId}/companyinfo/${realmId}`,
        { headers }
      ),
    ]);

    // Check for token expiration
    if (pnlResponse.status === 401 || bsResponse.status === 401) {
      const response = NextResponse.json(
        { error: 'QuickBooks session expired. Please reconnect.' },
        { status: 401 }
      );
      response.cookies.delete('qb_access_token');
      response.cookies.delete('qb_realm_id');
      return response;
    }

    if (!pnlResponse.ok) {
      const errText = await pnlResponse.text();
      console.error('QuickBooks P&L fetch failed:', errText);
      return NextResponse.json(
        { error: 'Failed to fetch P&L from QuickBooks' },
        { status: 502 }
      );
    }

    if (!bsResponse.ok) {
      const errText = await bsResponse.text();
      console.error('QuickBooks Balance Sheet fetch failed:', errText);
      return NextResponse.json(
        { error: 'Failed to fetch Balance Sheet from QuickBooks' },
        { status: 502 }
      );
    }

    const pnlData = await pnlResponse.json();
    const bsData = await bsResponse.json();

    // Extract company info if available
    let companyInfo = null;
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      companyInfo = {
        companyName: companyData?.CompanyInfo?.CompanyName || '',
        legalName: companyData?.CompanyInfo?.LegalName || '',
        fiscalYearStart: companyData?.CompanyInfo?.FiscalYearStartMonth || '',
        industry: companyData?.CompanyInfo?.IndustryType || '',
      };
    }

    // Parse QuickBooks report format into our structured format
    const parsedPnl = parseQBReport(pnlData);
    const parsedBs = parseQBReport(bsData);

    return NextResponse.json({
      success: true,
      companyInfo,
      profitAndLoss: parsedPnl,
      balanceSheet: parsedBs,
      rawPnl: pnlData,     // Include raw data for the classification pipeline
      rawBs: bsData,
      periodStart: startDate || '',
      periodEnd: endDate || '',
    });
  } catch (err) {
    console.error('QuickBooks pull-data error:', err);
    return NextResponse.json(
      { error: 'Failed to pull data from QuickBooks' },
      { status: 500 }
    );
  }
}

// ─── Parse QuickBooks Report JSON ────────────────────────────────────────────
// QB reports use a nested Row/ColData structure. This flattens it into
// a simple array of { label, amount, type, depth } for our pipeline.

interface ParsedLine {
  label: string;
  amount: number;
  type: 'header' | 'data' | 'total';
  depth: number;
}

function parseQBReport(report: Record<string, unknown>): ParsedLine[] {
  const lines: ParsedLine[] = [];

  function walkRows(rows: unknown[], depth: number) {
    if (!Array.isArray(rows)) return;

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const rowType = r.type as string;
      const colData = (r.ColData || r.colData) as Array<{ value: string }> | undefined;
      const header = r.Header as Record<string, unknown> | undefined;
      const summary = r.Summary as Record<string, unknown> | undefined;
      const subRows = r.Rows as Record<string, unknown> | undefined;

      if (rowType === 'Section') {
        // Section header
        if (header) {
          const headerCols = (header.ColData || header.colData) as Array<{ value: string }> | undefined;
          if (headerCols && headerCols.length > 0) {
            lines.push({
              label: headerCols[0]?.value || '',
              amount: parseFloat(headerCols[1]?.value || '0') || 0,
              type: 'header',
              depth,
            });
          }
        }

        // Recurse into sub-rows
        if (subRows) {
          const innerRows = (subRows.Row || subRows.row) as unknown[] | undefined;
          if (innerRows) walkRows(innerRows, depth + 1);
        }

        // Section summary/total
        if (summary) {
          const summaryCols = (summary.ColData || summary.colData) as Array<{ value: string }> | undefined;
          if (summaryCols && summaryCols.length > 0) {
            lines.push({
              label: summaryCols[0]?.value || '',
              amount: parseFloat(summaryCols[1]?.value || '0') || 0,
              type: 'total',
              depth,
            });
          }
        }
      } else if (rowType === 'Data' && colData) {
        // Data row
        lines.push({
          label: colData[0]?.value || '',
          amount: parseFloat(colData[1]?.value || '0') || 0,
          type: 'data',
          depth,
        });
      }
    }
  }

  const reportRows = report as Record<string, unknown>;
  const rowsContainer = reportRows.Rows as Record<string, unknown> | undefined;
  if (rowsContainer) {
    const topRows = (rowsContainer.Row || rowsContainer.row) as unknown[] | undefined;
    if (topRows) walkRows(topRows, 0);
  }

  return lines;
}
