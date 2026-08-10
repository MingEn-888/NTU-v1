"use strict";exports.id=207,exports.ids=[207],exports.modules={1898:(e,t,n)=>{n.d(t,{Cq:()=>y,Gw:()=>l,QU:()=>f,_b:()=>i,bU:()=>o,ck:()=>s,lr:()=>u,sA:()=>b});var a=n(2770);let r=["payment","swap_and_payment","bridge_and_payment"],s=["MYR","USD","USDC","USDT","SGD","EUR","GBP","ETH","POL"],i={RM:"MYR",MYR:"MYR",$:"USD",USD:"USD",USDC:"USDC",USDT:"USDT",SGD:"SGD",S$:"SGD",EUR:"EUR","€":"EUR",GBP:"GBP","\xa3":"GBP",ETH:"ETH",POL:"POL",MATIC:"POL"},l=["polygon","ethereum","arbitrum","base","optimism"],o=/^0x[a-fA-F0-9]{40}$/,u=1e9,d=a.Z_().trim().max(200).nullable(),c=a.Rx().positive().max(u).nullable(),m=a.Z_().trim().min(1).max(12).nullable(),p=a.Z_().trim().min(1).max(24).nullable(),b=a.Ry({action:a.Km(r),recipient:d,recipientAddress:d,amount:c,currency:m,sourceCurrency:m,sourceAmount:c,targetChain:p,purpose:d,dueDate:d,confidence:a.Rx().min(0).max(1),missingInformation:a.IX(a.Z_().trim().max(200))}),y=a.Ry({action:a.Km(r),recipient:a.Z_().max(200).nullable(),recipientAddress:a.Z_().regex(o,"must be a 0x-prefixed 40-hex wallet address").nullable(),amount:a.Rx().positive().max(u).nullable(),currency:a.Z_().max(12).nullable(),sourceCurrency:a.Z_().max(12).nullable(),sourceAmount:a.Rx().positive().max(u).nullable(),targetChain:a.Km(l).nullable(),purpose:a.Z_().max(300).nullable(),dueDate:a.Z_().max(200).nullable(),confidence:a.Rx().min(0).max(1),missingInformation:a.IX(a.Z_()),rawInput:a.Z_(),source:a.Km(["llm","fallback"])}),f=`
You are the IBAP Intent Extraction Engine, a component of an Intent-Based Agentic
Payment (IBAP) treasury system.

Your ONLY job is to convert a user's natural-language business payment instruction
into a single, precise, structured JSON intent. You never execute payments, never
move funds, and never make routing or settlement decisions. Deterministic code
downstream re-validates every field you emit and builds the actual payment request.

CORE RULES (non-negotiable):
1. EXTRACT ONLY WHAT IS EXPLICITLY STATED. Never fabricate, guess or infer any of:
   recipient names/entities, wallet addresses (0x...), payment amounts, currencies,
   invoice numbers/references, due dates, or chains.
2. If a field is not clearly stated, set it to null AND add a short human-readable
   entry to "missingInformation" describing exactly what is needed
   (e.g. "recipient wallet address", "amount", "invoice number").
3. NEVER invent a wallet address. Only copy an address the user typed verbatim
   (format: 0x followed by exactly 40 hex characters). If the user names a payee
   but gives no address, leave "recipientAddress" null and add
   "recipient wallet address" to "missingInformation".
4. "amount" must be a plain positive number with no commas and no currency symbols:
   "RM2,500" -> 2500, "$1,200" -> 1200. Convert spelled-out numbers only when
   unambiguous; otherwise null + missingInformation.
5. "currency" is the 3-4 letter code the user meant (MYR, USD, USDC, USDT, SGD,
   EUR, GBP, ETH, POL, ...). Prefer the code they wrote. If it cannot be
   determined, set null and add "currency" to missingInformation.
6. "dueDate" keeps the user's own wording as a short label ("Friday",
   "end of month", "2026-08-15"). Only set null when no deadline is mentioned.
7. Actions — use ONLY one of:
   - "payment": a direct payment in a single currency.
   - "swap_and_payment": the payment requires a currency swap first
     (e.g. "convert 5,000 USDT to USDC and pay X"). Fill "sourceCurrency" /
     "sourceAmount" for what is swapped from, and "currency" for what is paid.
   - "bridge_and_payment": the payment must be delivered on another chain
     (e.g. "send 2,000 USDC to X on Polygon"). Fill "targetChain" from
     polygon | ethereum | arbitrum | base | optimism.
8. "confidence" (0..1): rate how completely and unambiguously you could interpret
   the instruction. Use 0.9+ only when amount, currency and recipient are all
   explicit, and every field critical to the chosen action is present.
   Use lower values when any critical field is missing or ambiguous. Confidence is
   a security guarantee — never inflate it.
9. "purpose": a short description of what the payment is for, exactly as stated
   ("Invoice INV-1024", "March office rent", "Consulting retainer"). Do not invent
   one; set null if not stated.
10. Output ONLY the JSON object. No commentary, no markdown, no code fences.

Business payment examples:

Input: "Pay Alice RM2,500 for invoice INV-1024 by Friday."
Output: {"action":"payment","recipient":"Alice","recipientAddress":null,
"amount":2500,"currency":"MYR","sourceCurrency":null,"sourceAmount":null,
"targetChain":null,"purpose":"Invoice INV-1024","dueDate":"Friday",
"confidence":0.9,"missingInformation":["recipient wallet address"]}

Input: "Send $1,200 to Marcus for the website audit"
Output: {"action":"payment","recipient":"Marcus","recipientAddress":null,
"amount":1200,"currency":"USD","sourceCurrency":null,"sourceAmount":null,
"targetChain":null,"purpose":"Website audit","dueDate":null,
"confidence":0.8,"missingInformation":["recipient wallet address","due date"]}

Input: "Convert 5,000 USDT to USDC and pay the contractor"
Output: {"action":"swap_and_payment","recipient":"Contractor",
"recipientAddress":null,"amount":null,"currency":"USDC",
"sourceCurrency":"USDT","sourceAmount":5000,"targetChain":null,
"purpose":null,"dueDate":null,"confidence":0.6,
"missingInformation":["payment amount","recipient wallet address","purpose","due date"]}

Input: "Bridge 2,000 USDC to Polygon and pay Emma for rent"
Output: {"action":"bridge_and_payment","recipient":"Emma","recipientAddress":null,
"amount":2000,"currency":"USDC","sourceCurrency":null,"sourceAmount":null,
"targetChain":"polygon","purpose":"Rent","dueDate":null,"confidence":0.75,
"missingInformation":["recipient wallet address","due date"]}

Input: "Pay invoice INV-2048"
Output: {"action":"payment","recipient":null,"recipientAddress":null,
"amount":null,"currency":null,"sourceCurrency":null,"sourceAmount":null,
"targetChain":null,"purpose":"Invoice INV-2048","dueDate":null,"confidence":0.25,
"missingInformation":["recipient name","recipient wallet address","amount","currency","due date"]}
`.trim()},6862:(e,t,n)=>{n.d(t,{Re:()=>d,g0:()=>b});var a=n(703);let r=[{action:"SETTLE_INVOICE",re:/\b(?:settle|clear|pay off)\b.*\binvoice\b/i},{action:"REIMBURSE",re:/\b(?:reimburse|reimbursement)\b/i},{action:"PAY_VENDOR",re:/\b(?:pay|payout|paying)\b/i},{action:"PAY_RECIPIENT",re:/\b(?:send|transfer)\b/i}],s=String.raw`\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`,i=String.raw`RM|MYR|USD|USDC|USDT|ETH|POL|SGD`,l=RegExp(`(${s})\\s*(${i}|\\$|€|\xa3)(?=\\s|$|[.,!?;])`,"i"),o=RegExp(`(?:\\b(${i})|\\$|€|\xa3)\\s*(${s})`,"i"),u=/\b(?:invoice|inv)[\s#.-]*([A-Z0-9][A-Z0-9-]{1,24})\b/i,d={RM:{requestedCurrency:"USDC",fxRate:4.4,symbol:"RM"},MYR:{requestedCurrency:"USDC",fxRate:4.4,symbol:"RM"},USD:{requestedCurrency:"USDC",fxRate:1,symbol:"$"},$:{requestedCurrency:"USDC",fxRate:1,symbol:"$"},USDC:{requestedCurrency:"USDC",fxRate:1,symbol:"USDC"},USDT:{requestedCurrency:"USDT",fxRate:1,symbol:"USDT"},SGD:{requestedCurrency:"USDC",fxRate:1.35,symbol:"S$"},ETH:{requestedCurrency:"ETH",fxRate:1,symbol:"ETH"},POL:{requestedCurrency:"POL",fxRate:1,symbol:"POL"}};function c(e){return e.charAt(0).toUpperCase()+e.slice(1)}let m=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"],p={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};function b(e){let t=e.trim(),n="PAY_RECIPIENT";for(let e of r)if(e.re.test(t)){n=e.action;break}let s=null,i=null,b=t.match(l),y=t.match(o);if(b)s=parseFloat(b[1].replace(/,/g,"")),i=b[2].toUpperCase();else if(y){let e=y[0].match(/[$€£]/)?.[0]||null;i=y[1]?y[1].toUpperCase():e||null,s=parseFloat(y[2].replace(/,/g,""))}let{name:f,address:g}=function(e){let t=e.match(/0x[a-fA-F0-9]{40}/);if(t){let e=(0,a.g$)(t[0]);return{name:e?.name||null,address:t[0].toLowerCase()}}for(let t of a.Sh)for(let n of[t.name,...t.aliases])if(RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i").test(e))return{name:t.name,address:t.address};let n=e.match(/\b(?:pay|send|transfer|reimburse|settle)\s+(?:to\s+)?([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/);return n?{name:n[1].trim(),address:null}:{name:null,address:null}}(t),{purpose:C,invoiceNumber:D}=function(e){let t=null,n=e.match(u);n&&(t=n[1].toUpperCase().replace(/^INV[\s#.-]*/i,"")||null);let a=null,r=e.match(/\bfor\s+(.+?)(?:[.;,]|$)/i);if(r){let e=r[1].trim();(e=(e=e.replace(/\b(?:by|due|before)\s+[\w\s,]+$/i,"").trim()).replace(/\binvoice[\s#.-]*[A-Z0-9-]+/i,"").trim())?a=c(e):t&&(a=`Invoice ${t}`)}return!a&&t&&(a=`Invoice ${t}`),!a&&(/\brent\b/i.test(e)?a="Rent":/\bretainer\b/i.test(e)?a="Consulting retainer":/\btravel\b|\bexpenses?\b/i.test(e)?a="Travel & expenses":/\bconsult(?:ing|ancy)?\b/i.test(e)?a="Consulting fees":/\bsalary\b|\bpayroll\b/i.test(e)&&(a="Payroll")),{purpose:a,invoiceNumber:t}}(t),{label:h,date:S}=function(e){let t=e.toLowerCase(),n=new Date,a=new Date(n.getFullYear(),n.getMonth(),n.getDate());if(/\bend\s+of\s+(?:the\s+)?month\b|\bmonth[- ]?end\b/.test(t))return{label:"End of month",date:new Date(a.getFullYear(),a.getMonth()+1,0).toISOString()};if(/\bend\s+of\s+(?:the\s+)?week\b|\bweek[- ]?end\b/.test(t)){let e=a.getDay(),t=new Date(a);return t.setDate(a.getDate()+((7-e)%7||7)),{label:"End of week",date:t.toISOString()}}if(/\btoday\b/.test(t))return{label:"Today",date:a.toISOString()};if(/\btomorrow\b/.test(t)){let e=new Date(a);return e.setDate(a.getDate()+1),{label:"Tomorrow",date:e.toISOString()}}for(let e=0;e<m.length;e++)if(RegExp(`\\b${m[e]}\\b`,"i").test(t)){let t=(e-a.getDay()+7)%7;0===t&&(t=7);let n=new Date(a);return n.setDate(a.getDate()+t),{label:c(m[e]),date:n.toISOString()}}let r=t.match(/\bin\s+(\d+)\s+days?\b/);if(r){let e=new Date(a);return e.setDate(a.getDate()+parseInt(r[1],10)),{label:`In ${r[1]} days`,date:e.toISOString()}}if(/\bnext\s+week\b/.test(t)){let e=new Date(a);return e.setDate(a.getDate()+7),{label:"Next week",date:e.toISOString()}}let s=t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);if(s){let e=new Date(parseInt(s[1]),parseInt(s[2])-1,parseInt(s[3]));if(!isNaN(e.getTime()))return{label:e.toDateString(),date:e.toISOString()}}let i=t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);if(i){let e=new Date(a.getFullYear(),p[i[2]],parseInt(i[1],10));if(e.getTime()<a.getTime()&&e.setFullYear(a.getFullYear()+1),!isNaN(e.getTime()))return{label:e.toDateString(),date:e.toISOString()}}return{label:null,date:null}}(t),w=i?d[i]:null,I=w?.requestedCurrency||null;w?.fxRate;let x=.35;null!==s&&(x+=.2),i&&(x+=.12),(f||g)&&(x+=.18),C&&(x+=.08),S&&(x+=.05),x=Math.min(.98,Math.round(100*x)/100);let R=[];return null===s&&R.push("Amount not specified"),null===i&&R.push("Currency not specified"),f||g||R.push("Recipient not specified"),f&&!g&&R.push("Recipient wallet address not on file"),null===S&&R.push("No deadline given"),{detected:"PAY_RECIPIENT"!==n||null!==s&&null!==i&&(!!f||!!g),action:n,recipientName:f,recipientAddress:g,amount:s,currency:i?function(e){let t=e.toUpperCase();return"MYR"===t?"RM":t}(i):null,requestedCurrency:I,purpose:C,invoiceNumber:D,deadlineLabel:h,deadlineDate:S,confidence:x,missingInformation:R,rawInput:t}}},703:(e,t,n)=>{n.d(t,{GT:()=>s,Sh:()=>a,g$:()=>r});let a=[{name:"Alice Tan",aliases:["alice","alice tan","alice t","software vendor"],address:"0x71C7656EC7ab88b098defB751B7401B5f6d8976F",notes:"Software Vendor \xb7 Invoice INV-1024"},{name:"Marcus Lee",aliases:["contractor","marcus","marcus lee"],address:"0x1D5C3E09A75B1dE12FfCe9B4A2bCCc8Ef0Ae3d91",notes:"Freelance Contractor"},{name:"Priya Sharma",aliases:["priya","priya sharma","consultant","consulting"],address:"0x4B2A9fC87D5e1f0aB3C6d8E9F2A4b7c1D3e5F6a0",notes:"Strategy Consultant"},{name:"Emma Wong",aliases:["emma","emma wong","landlord","property"],address:"0x8aC1dF2B3e4F5a6b7C8d9E0f1A2b3C4d5E6f7A8b",notes:"Office Landlord"},{name:"David Chen",aliases:["david","david chen","vendor","supplier"],address:"0x2F3a4B5c6D7e8F9a0B1c2D3e4F5a6B7c8D9e0F1a",notes:"Equipment Supplier"},{name:"Nadia Rahman",aliases:["nadia","nadia rahman","marketing","agency"],address:"0x6C7d8E9f0A1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d",notes:"Marketing Agency"}];function r(e){let t=e.toLowerCase();return a.find(e=>e.address.toLowerCase()===t)||null}function s(e){let t=e.toLowerCase().trim();return t&&(a.find(e=>[e.name.toLowerCase(),...e.aliases].includes(t))||a.find(e=>[e.name.toLowerCase(),...e.aliases].some(e=>!!e.includes(t)||1===t.split(/\s+/).length&&t.split(/\s+/).some(t=>e.includes(t)))))||null}}};