"use strict";(()=>{var e={};e.id=625,e.ids=[625],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7147:e=>{e.exports=require("fs")},3685:e=>{e.exports=require("http")},5687:e=>{e.exports=require("https")},7561:e=>{e.exports=require("node:fs")},4492:e=>{e.exports=require("node:stream")},2477:e=>{e.exports=require("node:stream/web")},1017:e=>{e.exports=require("path")},5477:e=>{e.exports=require("punycode")},2781:e=>{e.exports=require("stream")},7310:e=>{e.exports=require("url")},3837:e=>{e.exports=require("util")},1267:e=>{e.exports=require("worker_threads")},9796:e=>{e.exports=require("zlib")},9475:(e,s,r)=>{r.r(s),r.d(s,{originalPathname:()=>y,patchFetch:()=>m,requestAsyncStorage:()=>l,routeModule:()=>u,serverHooks:()=>f,staticGenerationAsyncStorage:()=>d});var t={};r.r(t),r.d(t,{POST:()=>p});var n=r(9303),a=r(8716),i=r(670),o=r(7070);let c=new(r(672)).ZP({apiKey:process.env.ANTHROPIC_API_KEY,defaultHeaders:{"anthropic-beta":"prompt-caching-2024-07-31"}});async function p(e){try{let{transactions:s,questionnaire:r}=await e.json();if(!s||!Array.isArray(s))return o.NextResponse.json({error:"Invalid transactions data"},{status:400});let t=function(e){let{businessName:s,entityType:r,industry:t,businessDescription:n,primaryRevenueSources:a,paymentProcessors:i,isServiceBusiness:o,inventoryVendors:c,softwareSubscriptions:p,advertisingPlatforms:u,hasOfficeRent:l,rentAmount:d,professionalServices:f,hasInsurance:y,hasBusinessLoans:m,loanLenders:h,hasVehicleExpense:x,vehicleBusinessPercent:O,hasTravelExpense:S,hasMealsExpense:v,mealsBusinessPercent:g,hasMixedAccount:$,primaryPersonalVendors:E,ownerPaymentMethod:b,ownerDrawAmount:N,hasLargeSinglePayments:P,largeSinglePaymentDescription:R}=e;return`You are an expert CPA classifying business transactions for a Profit & Loss statement.

## BUSINESS CONTEXT
- Business: ${s}
- Entity: ${r}
- Industry: ${t}
- Description: ${n}

## REVENUE SOURCES
${a}
Payment processors: ${Array.isArray(i)?i.join(", "):i}

## COST STRUCTURE
Service business (no COGS): ${o?"YES":"NO"}
${o?"":`Inventory vendors: ${c}`}

## KNOWN OPERATING EXPENSES
Software subscriptions: ${p}
Advertising platforms: ${Array.isArray(u)?u.join(", "):u}
${l?`Office rent: ~$${d}/month`:"No office rent"}
Professional services: ${f}
${y?"Has business insurance":""}
${m?`Business loans: ${h}`:""}
${x?`Vehicle: ${O}% business use`:""}
${S?"Has business travel":""}
${v?`Business meals: ${g}% of restaurant charges`:""}

## PERSONAL / OWNER CONTEXT
Mixed personal/business account: ${$?"YES":"NO"}
${$?`Personal vendors to EXCLUDE: ${E}`:""}
Owner compensation: ${b} ${N?`(~${N})`:""}
${P?`NOTE - Large one-time items: ${R}`:""}

## CLASSIFICATION RULES
1. Revenue: Money coming IN from business activities (credits from payment processors, client payments, etc.)
2. Cost of Goods Sold: Direct costs to produce product/service (inventory, direct labor, shipping)
3. Operating Expenses: Indirect business costs (rent, software, marketing, professional services, insurance)
4. Owner's Draw: Transfers to owner / self payments — these are NOT expenses, they are equity distributions
5. Personal: Items that are personal, not business. These should be excluded from the P&L.
6. Transfers: Internal transfers between accounts — NOT revenue or expenses
7. Loan payments: Separate principal (balance sheet) from interest (expense). If unclear, classify as "Debt Service"

P&L CATEGORIES to use:
Revenue: "Sales Revenue", "Service Revenue", "Other Income"
COGS: "Cost of Goods", "Direct Labor", "Shipping & Fulfillment"
Operating: "Software & Subscriptions", "Marketing & Advertising", "Rent & Facilities", "Professional Services", "Insurance", "Vehicle Expense", "Travel", "Meals & Entertainment", "Bank Fees", "Utilities", "Office Supplies", "Payroll & Wages", "Debt Service", "Other Operating"
Non-P&L: "Owner's Draw", "Personal", "Transfer", "Tax Payment"

## OUTPUT FORMAT
Return ONLY valid JSON array. Each item must have:
{
  "date": "YYYY-MM-DD",
  "description": "original description",
  "amount": number,
  "type": "credit" or "debit",
  "category": "Revenue" | "Cost of Goods Sold" | "Operating Expenses" | "Non-P&L",
  "subcategory": one of the P&L categories above,
  "isBusinessExpense": boolean,
  "confidence": 0.0-1.0
}`}(r||{}),n=[];for(let e=0;e<s.length;e+=20){let r=s.slice(e,e+20),a=(await c.messages.create({model:"claude-sonnet-4-5",max_tokens:4096,system:[{type:"text",text:t,cache_control:{type:"ephemeral"}}],messages:[{role:"user",content:`Classify these ${r.length} transactions. Return only the JSON array:

${JSON.stringify(r,null,2)}`}]})).content[0];if("text"===a.type)try{let e=a.text.trim().replace(/^```json\n?/,"").replace(/\n?```$/,""),s=JSON.parse(e);n.push(...s)}catch{n.push(...r.map(e=>({...e,category:"credit"===e.type?"Revenue":"Operating Expenses",subcategory:"credit"===e.type?"Sales Revenue":"Other Operating",isBusinessExpense:"debit"===e.type,confidence:.4})))}}return o.NextResponse.json({classified:n,count:n.length})}catch(e){return console.error("Classification error:",e),o.NextResponse.json({error:"Classification failed",classified:[]},{status:500})}}let u=new n.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/classify-transactions/route",pathname:"/api/classify-transactions",filename:"route",bundlePath:"app/api/classify-transactions/route"},resolvedPagePath:"/Users/ausar/Downloads/financialsfast-app/src/app/api/classify-transactions/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:l,staticGenerationAsyncStorage:d,serverHooks:f}=u,y="/api/classify-transactions/route";function m(){return(0,i.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:d})}}};var s=require("../../../webpack-runtime.js");s.C(e);var r=e=>s(s.s=e),t=s.X(0,[948,972,672],()=>r(9475));module.exports=t})();