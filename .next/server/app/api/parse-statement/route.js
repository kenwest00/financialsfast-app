"use strict";(()=>{var e={};e.id=971,e.ids=[971],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7147:e=>{e.exports=require("fs")},3685:e=>{e.exports=require("http")},5687:e=>{e.exports=require("https")},7561:e=>{e.exports=require("node:fs")},4492:e=>{e.exports=require("node:stream")},2477:e=>{e.exports=require("node:stream/web")},1017:e=>{e.exports=require("path")},5477:e=>{e.exports=require("punycode")},2781:e=>{e.exports=require("stream")},7310:e=>{e.exports=require("url")},3837:e=>{e.exports=require("util")},1267:e=>{e.exports=require("worker_threads")},9796:e=>{e.exports=require("zlib")},5024:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>f,patchFetch:()=>h,requestAsyncStorage:()=>l,routeModule:()=>c,serverHooks:()=>x,staticGenerationAsyncStorage:()=>m});var a={};r.r(a),r.d(a,{POST:()=>d});var s=r(9303),n=r(8716),o=r(670),i=r(7070);let p=new(r(672)).ZP({apiKey:process.env.ANTHROPIC_API_KEY}),u=`You are a financial data extraction specialist. Your task is to extract transaction data from bank statement text.

Extract ALL transactions from the provided bank statement text and return them as a JSON array.

For each transaction, extract:
- date: ISO date string (YYYY-MM-DD)
- description: The full transaction description/memo as it appears
- amount: Numeric amount (positive number)
- type: "credit" (money coming in) or "debit" (money going out)

Rules:
- Include ALL transactions, including fees, transfers, and adjustments
- Use the actual date shown, not posting date if both are listed
- Amount should always be positive — use "type" to indicate direction
- If a transaction description has "POS", "DEBIT", "CREDIT", "ACH", etc., keep those prefixes
- Exclude running balance entries (they are not transactions)
- Exclude statement headers, summaries, and metadata

Return ONLY a valid JSON array. No markdown, no explanation. Example:
[
  {"date":"2024-01-15","description":"SQ *COFFEE SHOP 01/15","amount":8.50,"type":"debit"},
  {"date":"2024-01-16","description":"STRIPE TRANSFER","amount":2450.00,"type":"credit"}
]`;async function d(e){try{let t;let r=(await e.formData()).get("file");if(!r)return i.NextResponse.json({error:"No file provided"},{status:400});let a=await r.arrayBuffer(),s=Buffer.from(a).toString("base64"),n=(await p.messages.create({model:"claude-sonnet-4-5",max_tokens:8192,system:u,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:s}},{type:"text",text:"Extract all transactions from this bank statement. Return only the JSON array."}]}]})).content[0];if("text"!==n.type)throw Error("Unexpected response type from Claude");try{let e=n.text.trim().replace(/^```json\n?/,"").replace(/\n?```$/,"");t=JSON.parse(e)}catch{throw Error("Failed to parse Claude response as JSON")}return i.NextResponse.json({transactions:t,count:t.length})}catch(e){return console.error("PDF parse error:",e),i.NextResponse.json({error:"Failed to parse bank statement",transactions:[]},{status:500})}}let c=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/parse-statement/route",pathname:"/api/parse-statement",filename:"route",bundlePath:"app/api/parse-statement/route"},resolvedPagePath:"/Users/ausar/Downloads/financialsfast-app/src/app/api/parse-statement/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:x}=c,f="/api/parse-statement/route";function h(){return(0,o.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:m})}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[948,972,672],()=>r(5024));module.exports=a})();