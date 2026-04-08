import { NextRequest, NextResponse } from 'next/server';

// ─── Generate consultation packet PDF ────────────────────────────────────────
// Produces a professional cover sheet + narrative + document manifest
// Uses HTML → PDF via Puppeteer (same approach as generate-pdf route)

function today(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function buildPacketHTML(
  contact: { name: string; email: string; phone: string; businessName: string; loanAmount: string },
  narrative: { businessDescription: string; loanPurpose: string; challenges: string },
  manifest: { category: string; name: string; size: number }[],
  selectedSlot: string,
): string {
  const categoryLabels: Record<string, string> = {
    'personal-tax': 'Personal Tax Returns',
    'bank-statements': 'Bank Statements',
    'business-tax': 'Business Tax Returns',
    'pnl': 'Current Year P&L',
    'balance-sheet': 'Balance Sheet',
  };

  const slotDisplay = selectedSlot ? (() => {
    const [date, time] = selectedSlot.split('_');
    try {
      return `${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${time}`;
    } catch { return selectedSlot; }
  })() : 'Not yet scheduled';

  const groupedDocs: Record<string, { name: string; size: number }[]> = {};
  for (const doc of manifest) {
    if (!groupedDocs[doc.category]) groupedDocs[doc.category] = [];
    groupedDocs[doc.category].push(doc);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: letter;
    margin: 0.75in 0.85in;
  }

  body {
    font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
    color: #1a1a2e;
    font-size: 11pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Cover Page ── */
  .cover {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 100vh;
    padding: 2in 0;
  }

  .cover-brand {
    font-size: 14pt;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #C9A84C;
    margin-bottom: 0.5in;
  }

  .cover-title {
    font-size: 28pt;
    font-weight: 700;
    color: #1B3A5C;
    line-height: 1.2;
    margin-bottom: 0.15in;
  }

  .cover-subtitle {
    font-size: 14pt;
    color: #64748b;
    margin-bottom: 0.6in;
  }

  .cover-line {
    width: 60px;
    height: 3px;
    background: #C9A84C;
    margin-bottom: 0.4in;
  }

  .cover-meta {
    font-size: 10pt;
    color: #94a3b8;
    line-height: 1.8;
  }
  .cover-meta strong {
    color: #1a1a2e;
    font-weight: 600;
  }

  .cover-footer {
    position: fixed;
    bottom: 0.75in;
    left: 0.85in;
    right: 0.85in;
    font-size: 8pt;
    color: #cbd5e0;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
  }

  /* ── Section Pages ── */
  .section-page {
    page-break-before: always;
  }

  .section-header {
    font-size: 9pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #C9A84C;
    font-weight: 600;
    margin-bottom: 6px;
  }

  h2 {
    font-size: 18pt;
    font-weight: 700;
    color: #1B3A5C;
    margin-bottom: 4px;
  }

  .section-rule {
    width: 100%;
    height: 1.5px;
    background: #1B3A5C;
    margin: 12px 0 24px 0;
  }

  /* ── Info grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px 40px;
    margin-bottom: 32px;
  }

  .info-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
    margin-bottom: 2px;
  }

  .info-value {
    font-size: 11pt;
    color: #1a1a2e;
    font-weight: 600;
  }

  /* ── Narrative ── */
  .narrative-block {
    margin-bottom: 28px;
  }

  .narrative-label {
    font-size: 10pt;
    font-weight: 700;
    color: #1B3A5C;
    margin-bottom: 6px;
    border-left: 3px solid #C9A84C;
    padding-left: 10px;
  }

  .narrative-text {
    font-size: 11pt;
    color: #334155;
    line-height: 1.65;
    padding-left: 13px;
  }

  /* ── Document manifest ── */
  .doc-category {
    margin-bottom: 20px;
  }

  .doc-category-title {
    font-size: 10pt;
    font-weight: 700;
    color: #1B3A5C;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 8px;
  }

  .doc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
    font-size: 10pt;
  }

  .doc-check {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #059669;
    color: white;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .doc-name {
    color: #334155;
    flex: 1;
  }

  .doc-size {
    color: #94a3b8;
    font-size: 9pt;
  }

  /* ── Consultation details ── */
  .consult-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin-top: 32px;
  }

  .consult-title {
    font-size: 10pt;
    font-weight: 700;
    color: #1B3A5C;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .consult-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 10pt;
    border-bottom: 1px solid #f1f5f9;
  }

  .consult-row:last-child { border-bottom: none; }
  .consult-label { color: #64748b; }
  .consult-value { color: #1a1a2e; font-weight: 600; }

  /* ── Confidential footer ── */
  .page-footer {
    font-size: 7.5pt;
    color: #cbd5e0;
    text-align: center;
    margin-top: 48px;
    padding-top: 12px;
    border-top: 0.5px solid #e2e8f0;
  }
</style>
</head>
<body>

<!-- ═══ COVER PAGE ═══ -->
<div class="cover">
  <div class="cover-brand">Financials Fast</div>
  <div class="cover-title">Underwriting<br>Consultation Packet</div>
  <div class="cover-subtitle">Prepared for ${contact.businessName}</div>
  <div class="cover-line"></div>
  <div class="cover-meta">
    <strong>Prepared:</strong> ${today()}<br>
    <strong>Client:</strong> ${contact.name}<br>
    <strong>Loan Amount Requested:</strong> ${contact.loanAmount || 'To be discussed'}<br>
    <strong>Consultation:</strong> ${slotDisplay}
  </div>
</div>

<div class="cover-footer">
  <span>CONFIDENTIAL — Prepared by Financials Fast</span>
  <span>www.financialsfast.com</span>
</div>

<!-- ═══ CONTACT & OVERVIEW ═══ -->
<div class="section-page">
  <div class="section-header">Section 1</div>
  <h2>Client Overview</h2>
  <div class="section-rule"></div>

  <div class="info-grid">
    <div>
      <div class="info-label">Full Name</div>
      <div class="info-value">${contact.name}</div>
    </div>
    <div>
      <div class="info-label">Business Name</div>
      <div class="info-value">${contact.businessName}</div>
    </div>
    <div>
      <div class="info-label">Email</div>
      <div class="info-value">${contact.email}</div>
    </div>
    <div>
      <div class="info-label">Phone</div>
      <div class="info-value">${contact.phone || 'Not provided'}</div>
    </div>
    <div>
      <div class="info-label">Loan Amount Sought</div>
      <div class="info-value">${contact.loanAmount || 'To be discussed'}</div>
    </div>
    <div>
      <div class="info-label">Packet Date</div>
      <div class="info-value">${today()}</div>
    </div>
  </div>

  <div class="consult-box">
    <div class="consult-title">Consultation Details</div>
    <div class="consult-row">
      <span class="consult-label">Service</span>
      <span class="consult-value">Underwriting Summary — Full Application Package</span>
    </div>
    <div class="consult-row">
      <span class="consult-label">Scheduled</span>
      <span class="consult-value">${slotDisplay}</span>
    </div>
    <div class="consult-row">
      <span class="consult-label">Consulting Hours</span>
      <span class="consult-value">Up to 4 hours</span>
    </div>
    <div class="consult-row">
      <span class="consult-label">Deliverables</span>
      <span class="consult-value">Complete lender application package + business plan</span>
    </div>
  </div>
</div>

<!-- ═══ BUSINESS NARRATIVE ═══ -->
<div class="section-page">
  <div class="section-header">Section 2</div>
  <h2>Business Narrative</h2>
  <div class="section-rule"></div>

  <div class="narrative-block">
    <div class="narrative-label">Business Description & Current Stage</div>
    <p class="narrative-text">${narrative.businessDescription || '<em>Not provided</em>'}</p>
  </div>

  <div class="narrative-block">
    <div class="narrative-label">Loan Purpose & Expected Impact</div>
    <p class="narrative-text">${narrative.loanPurpose || '<em>Not provided</em>'}</p>
  </div>

  ${narrative.challenges ? `
  <div class="narrative-block">
    <div class="narrative-label">Challenges & Upcoming Changes</div>
    <p class="narrative-text">${narrative.challenges}</p>
  </div>
  ` : ''}
</div>

<!-- ═══ DOCUMENT MANIFEST ═══ -->
<div class="section-page">
  <div class="section-header">Section 3</div>
  <h2>Document Checklist</h2>
  <div class="section-rule"></div>

  ${Object.entries(groupedDocs).map(([catId, files]) => `
  <div class="doc-category">
    <div class="doc-category-title">${categoryLabels[catId] || catId}</div>
    ${files.map((f) => `
    <div class="doc-item">
      <div class="doc-check">&#10003;</div>
      <span class="doc-name">${f.name}</span>
      <span class="doc-size">${(f.size / 1024).toFixed(0)} KB</span>
    </div>
    `).join('')}
  </div>
  `).join('')}

  <p style="font-size: 9pt; color: #94a3b8; margin-top: 24px;">
    Total: ${manifest.length} document${manifest.length !== 1 ? 's' : ''} uploaded and available for review.
    All documents are stored securely and shared only with the assigned consultant.
  </p>

  <div class="page-footer">
    CONFIDENTIAL — This packet was prepared by Financials Fast (www.financialsfast.com) for the exclusive use of the assigned consultant.<br>
    Do not distribute without authorization. Generated ${today()}.
  </div>
</div>

</body>
</html>`;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const contact = JSON.parse(formData.get('contact') as string || '{}');
    const narrative = JSON.parse(formData.get('narrative') as string || '{}');
    const manifest = JSON.parse(formData.get('manifest') as string || '[]');
    const selectedSlot = formData.get('selectedSlot') as string || '';

    const html = buildPacketHTML(contact, narrative, manifest, selectedSlot);

    // Try Puppeteer (Vercel serverless)
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

        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${contact.businessName?.replace(/\s+/g, '_') || 'Consultation'}_Packet.pdf"`,
          },
        });
      }
    } catch (e) {
      console.warn('Puppeteer unavailable for packet generation:', e);
    }

    // Fallback: return HTML
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${contact.businessName?.replace(/\s+/g, '_') || 'Consultation'}_Packet.html"`,
      },
    });
  } catch (error) {
    console.error('Packet generation error:', error);
    return NextResponse.json({ error: 'Failed to generate packet' }, { status: 500 });
  }
}
