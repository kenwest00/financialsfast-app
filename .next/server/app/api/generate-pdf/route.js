"use strict";(()=>{var e={};e.id=963,e.ids=[963],e.modules={7622:e=>{e.exports=require("@sparticuz/chromium-min")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},1107:e=>{e.exports=require("puppeteer-core")},7706:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>m,patchFetch:()=>f,requestAsyncStorage:()=>c,routeModule:()=>p,serverHooks:()=>g,staticGenerationAsyncStorage:()=>u});var i={};a.r(i),a.d(i,{POST:()=>d});var o=a(9303),r=a(8716),s=a(670),n=a(7070);function l(e){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:0}).format(e)}async function d(e){try{let{pnlData:t}=await e.json();if(!t)return n.NextResponse.json({error:"P&L data required"},{status:400});let i=function(e){let{businessName:t,period:a,reportingBasis:i,revenue:o,cogs:r,opex:s,totalRevenue:n,totalCOGS:d,grossProfit:p,grossMargin:c,totalOpex:u,netIncome:g,netMargin:m,transactionCount:f,generatedAt:v}=e,b={3:"3-Month",6:"6-Month",12:"12-Month (Annual)",ytd:"Year-to-Date"}[a]||"Selected Period",h=new Date(v).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),x=(e,t,a=!1,i=!1,o=!1)=>{let r=o&&t>0?`(${l(t)})`:l(Math.abs(t));return`
      <tr class="${i?"bold-row":""} ${a?"indent":""}">
        <td class="line-label">${e}</td>
        <td class="line-value ${t<0?"negative":""}">${r}</td>
      </tr>`},w=(e,t=!1)=>Object.entries(e).filter(([,e])=>0!==e).map(([e,a])=>x(e,a,!0,!1,t)).join("");return`<!DOCTYPE html>
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
    <h2>${t}</h2>
    <div class="cover-meta">
      <div><strong>Reporting Period:</strong> ${b}</div>
      <div><strong>Accounting Basis:</strong> ${"cash"===i?"Cash Basis":"Accrual Basis"}</div>
      <div><strong>Prepared:</strong> ${h}</div>
      <div><strong>Transactions Analyzed:</strong> ${f?.toLocaleString()||"—"}</div>
    </div>
  </div>
  <div class="cover-footer">
    <p><strong>IMPORTANT NOTICE:</strong> This statement is owner-prepared and AI-assisted. It is not prepared, reviewed, or audited by a licensed CPA or accounting firm. This document should be used for informational purposes and loan application support only. The business owner is responsible for the accuracy of all information provided.</p>
    <p style="margin-top:8px">Generated by Financials Fast (financialsfast.com) \xb7 For questions, contact the business owner directly.</p>
  </div>
</div>

<!-- P&L Statement Page -->
<div class="page">
  <div class="page-header">
    <div>
      <h1>Profit &amp; Loss</h1>
      <div class="sub">${t} \xb7 ${b} \xb7 ${"cash"===i?"Cash Basis":"Accrual Basis"}</div>
    </div>
    <div class="date">Prepared: ${h}<br>Transactions: ${f?.toLocaleString()||"—"}</div>
  </div>

  <!-- Key Metrics -->
  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">${l(n)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Gross Margin</div>
      <div class="metric-value">${c.toFixed(1)}%</div>
    </div>
    <div class="metric">
      <div class="metric-label">Net Income</div>
      <div class="metric-value ${g<0?"net-negative":""}">${l(g)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Net Margin</div>
      <div class="metric-value ${m<0?"net-negative":""}">${m.toFixed(1)}%</div>
    </div>
  </div>

  <!-- Revenue -->
  <div class="section-title">Revenue</div>
  <table>
    ${w(o)}
    ${x("Total Revenue",n,!1,!0)}
  </table>

  <!-- COGS -->
  ${d>0?`
  <div class="section-title">Cost of Goods Sold</div>
  <table>
    ${w(r,!0)}
    ${x("Total Cost of Goods Sold",d,!1,!0,!0)}
  </table>
  `:""}

  <!-- Gross Profit -->
  <table>
    <tr class="total-row">
      <td>Gross Profit</td>
      <td class="line-value ${p<0?"net-negative":""}">${l(p)}</td>
    </tr>
  </table>

  <!-- Operating Expenses -->
  <div class="section-title">Operating Expenses</div>
  <table>
    ${w(s,!0)}
    ${x("Total Operating Expenses",u,!1,!0,!0)}
  </table>

  <!-- Net Income -->
  <table>
    <tr class="total-row">
      <td>Net Income</td>
      <td class="line-value ${g<0?"net-negative":""}">${l(g)}</td>
    </tr>
  </table>

  <!-- Notes -->
  <div class="notes">
    <h3>Notes &amp; Assumptions</h3>
    <p>• This statement is prepared on a <strong>${"cash"===i?"cash basis":"accrual basis"}</strong>, recording transactions when cash is received or disbursed.</p>
    <p>• Transactions were classified using AI-assisted analysis informed by business owner questionnaire responses. Confidence thresholds were applied to route uncertain transactions for review.</p>
    <p>• Owner draws and personal expenses are excluded from this statement. Mixed personal/business transactions were separated based on owner-provided guidance.</p>
    <p>• This statement covers ${b.toLowerCase()} of business activity based on ${f?.toLocaleString()||"analyzed"} bank transactions.</p>
    <p>• This document has not been reviewed or audited by a licensed CPA. For tax filing purposes, consult a qualified tax professional.</p>
  </div>
</div>

</body>
</html>`}(t);try{let e=await Promise.resolve().then(a.t.bind(a,7622,23)).catch(()=>null),o=await Promise.resolve().then(a.t.bind(a,1107,23)).catch(()=>null);if(e&&o){let a=await e.default.executablePath("https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar"),r=await o.default.launch({args:e.default.args,defaultViewport:e.default.defaultViewport,executablePath:a,headless:!0}),s=await r.newPage();await s.setContent(i,{waitUntil:"networkidle0"});let l=await s.pdf({format:"Letter",printBackground:!0,margin:{top:"0",bottom:"0",left:"0",right:"0"}});return await r.close(),new n.NextResponse(l.buffer,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${t.businessName||"PnL"}-Statement.pdf"`,"Cache-Control":"no-store"}})}}catch(e){console.warn("Puppeteer unavailable, returning HTML:",e)}return new n.NextResponse(i,{status:200,headers:{"Content-Type":"text/html","X-PDF-Fallback":"true"}})}catch(e){return console.error("PDF generation error:",e),n.NextResponse.json({error:"PDF generation failed"},{status:500})}}let p=new o.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/generate-pdf/route",pathname:"/api/generate-pdf",filename:"route",bundlePath:"app/api/generate-pdf/route"},resolvedPagePath:"/Users/ausar/Downloads/financialsfast-app/src/app/api/generate-pdf/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:c,staticGenerationAsyncStorage:u,serverHooks:g}=p,m="/api/generate-pdf/route";function f(){return(0,s.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:u})}}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[948,972],()=>a(7706));module.exports=i})();