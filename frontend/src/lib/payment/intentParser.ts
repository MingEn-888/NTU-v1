// =============================================================================
// IBAP Intent Parser
// Deterministic natural-language intent engine for business payment operations.
// Converts utterances like:
//   "Pay Alice RM2,500 for invoice INV-1024 by Friday."
// into a structured ParsedPaymentIntent (Recipient / Amount / Purpose / Deadline).
// =============================================================================

import type { ParsedPaymentIntent } from "./types";
import { VENDOR_DIRECTORY, findVendorByAddress } from "./vendors";

// --- Action detection -------------------------------------------------------

const ACTION_PATTERNS: { action: string; re: RegExp }[] = [
  { action: "SETTLE_INVOICE", re: /\b(?:settle|clear|pay off)\b.*\binvoice\b/i },
  { action: "REIMBURSE", re: /\b(?:reimburse|reimbursement)\b/i },
  { action: "PAY_VENDOR", re: /\b(?:pay|payout|paying)\b/i },
  { action: "PAY_RECIPIENT", re: /\b(?:send|transfer)\b/i },
];

// --- Amount + currency -------------------------------------------------------

// "RM2,500", "RM 2,500", "2,500 RM", "$1,200", "1200 USDC", "1 ETH" ...
const NUMBER = String.raw`\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
const CURRENCY_CODES = String.raw`RM|MYR|USD|USDC|USDT|ETH|POL|SGD`;
// number-before-currency: "2,500 RM", "1200 USDC", "450 $" ...
const AMOUNT_CURRENCY_RE = new RegExp(
  `(${NUMBER})\\s*(${CURRENCY_CODES}|\\$|€|£)(?=\\s|$|[.,!?;])`,
  "i"
);
// currency-before-number: "RM2,500", "USD 1200", "$1,200" ...
const CURRENCY_AMOUNT_RE = new RegExp(
  `(?:\\b(${CURRENCY_CODES})|\\$|€|£)\\s*(${NUMBER})`,
  "i"
);

const INVOICE_RE = /\b(?:invoice|inv)[\s#.-]*([A-Z0-9][A-Z0-9-]{1,24})\b/i;

// --- FX / settlement currency mapping ---------------------------------------

export const CURRENCY_CONFIG: Record<
  string,
  { requestedCurrency: string; fxRate: number; symbol: string }
> = {
  RM: { requestedCurrency: "USDC", fxRate: 4.4, symbol: "RM" },
  MYR: { requestedCurrency: "USDC", fxRate: 4.4, symbol: "RM" },
  USD: { requestedCurrency: "USDC", fxRate: 1, symbol: "$" },
  $: { requestedCurrency: "USDC", fxRate: 1, symbol: "$" },
  USDC: { requestedCurrency: "USDC", fxRate: 1, symbol: "USDC" },
  USDT: { requestedCurrency: "USDT", fxRate: 1, symbol: "USDT" },
  SGD: { requestedCurrency: "USDC", fxRate: 1.35, symbol: "S$" },
  ETH: { requestedCurrency: "ETH", fxRate: 1, symbol: "ETH" },
  POL: { requestedCurrency: "POL", fxRate: 1, symbol: "POL" },
};

export function normalizeCurrency(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper === "MYR") return "RM";
  return upper;
}

// --- Helpers -----------------------------------------------------------------

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Deadline parsing ---------------------------------------------------------

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDeadline(text: string): { label: string | null; date: string | null } {
  const lower = text.toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (/\bend\s+of\s+(?:the\s+)?month\b|\bmonth[- ]?end\b/.test(lower)) {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { label: "End of month", date: end.toISOString() };
  }
  if (/\bend\s+of\s+(?:the\s+)?week\b|\bweek[- ]?end\b/.test(lower)) {
    const dow = today.getDay();
    const diff = ((7 - dow) % 7) || 7;
    const end = new Date(today);
    end.setDate(today.getDate() + diff);
    return { label: "End of week", date: end.toISOString() };
  }
  if (/\btoday\b/.test(lower)) {
    return { label: "Today", date: today.toISOString() };
  }
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(today.getDate() + 1);
    return { label: "Tomorrow", date: d.toISOString() };
  }
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const re = new RegExp(`\\b${DAY_NAMES[i]}\\b`, "i");
    if (re.test(lower)) {
      const dow = today.getDay();
      let diff = (i - dow + 7) % 7;
      if (diff === 0) diff = 7; // always the *next* occurrence
      const d = new Date(today);
      d.setDate(today.getDate() + diff);
      return { label: capFirst(DAY_NAMES[i]), date: d.toISOString() };
    }
  }
  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(today.getDate() + parseInt(inDays[1], 10));
    return { label: `In ${inDays[1]} days`, date: d.toISOString() };
  }
  if (/\bnext\s+week\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    return { label: "Next week", date: d.toISOString() };
  }
  // Explicit calendar date: "12 Aug" / "Aug 12" / "2026-08-15" / "15/08/2026"
  const iso = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    if (!isNaN(d.getTime())) return { label: d.toDateString(), date: d.toISOString() };
  }
  const ddMon = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (ddMon) {
    const d = new Date(today.getFullYear(), MONTHS[ddMon[2]], parseInt(ddMon[1], 10));
    if (d.getTime() < today.getTime()) d.setFullYear(today.getFullYear() + 1);
    if (!isNaN(d.getTime())) return { label: d.toDateString(), date: d.toISOString() };
  }
  return { label: null, date: null };
}

// --- Recipient extraction -----------------------------------------------------

function extractRecipient(text: string): { name: string | null; address: string | null } {
  // 1) Raw wallet address mentioned directly.
  const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
  if (addrMatch) {
    const vendor = findVendorByAddress(addrMatch[0]);
    return { name: vendor?.name || null, address: addrMatch[0].toLowerCase() };
  }

  // 2) Known vendor / payee from the business directory.
  for (const vendor of VENDOR_DIRECTORY) {
    const names = [vendor.name, ...vendor.aliases];
    for (const n of names) {
      if (new RegExp(`\\b${escapeRegExp(n)}\\b`, "i").test(text)) {
        return { name: vendor.name, address: vendor.address };
      }
    }
  }

  // 3) Generic proper-noun payee after a payment verb ("pay Alice", "to Priya").
  const afterVerb = text.match(
    /\b(?:pay|send|transfer|reimburse|settle)\s+(?:to\s+)?([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/
  );
  if (afterVerb) {
    return { name: afterVerb[1].trim(), address: null };
  }

  return { name: null, address: null };
}

// --- Purpose extraction -------------------------------------------------------

function extractPurpose(text: string): { purpose: string | null; invoiceNumber: string | null } {
  let invoiceNumber: string | null = null;
  const inv = text.match(INVOICE_RE);
  if (inv) {
    // Normalize: "invoice INV-1024" captures "INV-1024", "inv-1024" captures "1024".
    const normalized = inv[1].toUpperCase().replace(/^INV[\s#.-]*/i, "");
    invoiceNumber = normalized || null;
  }

  let purpose: string | null = null;
  const forMatch = text.match(/\bfor\s+(.+?)(?:[.;,]|$)/i);
  if (forMatch) {
    let p = forMatch[1].trim();
    // Strip a trailing "by <deadline>" clause.
    p = p.replace(/\b(?:by|due|before)\s+[\w\s,]+$/i, "").trim();
    // Strip the invoice token itself when it's the entire purpose.
    p = p.replace(/\binvoice[\s#.-]*[A-Z0-9-]+/i, "").trim();
    if (p) {
      purpose = capFirst(p);
    } else if (invoiceNumber) {
      purpose = `Invoice ${invoiceNumber}`;
    }
  }

  if (!purpose && invoiceNumber) purpose = `Invoice ${invoiceNumber}`;

  if (!purpose) {
    if (/\brent\b/i.test(text)) purpose = "Rent";
    else if (/\bretainer\b/i.test(text)) purpose = "Consulting retainer";
    else if (/\btravel\b|\bexpenses?\b/i.test(text)) purpose = "Travel & expenses";
    else if (/\bconsult(?:ing|ancy)?\b/i.test(text)) purpose = "Consulting fees";
    else if (/\bsalary\b|\bpayroll\b/i.test(text)) purpose = "Payroll";
  }

  return { purpose, invoiceNumber };
}

// --- Main parser --------------------------------------------------------------

export function parsePaymentIntent(rawInput: string): ParsedPaymentIntent {
  const text = rawInput.trim();

  // Action
  let action = "PAY_RECIPIENT";
  for (const p of ACTION_PATTERNS) {
    if (p.re.test(text)) {
      action = p.action;
      break;
    }
  }

  // Amount + currency (currency may come before or after the number)
  let amount: number | null = null;
  let currency: string | null = null;
  const m1 = text.match(AMOUNT_CURRENCY_RE);
  const m2 = text.match(CURRENCY_AMOUNT_RE);
  if (m1) {
    amount = parseFloat(m1[1].replace(/,/g, ""));
    currency = m1[2].toUpperCase();
  } else if (m2) {
    // Group 1 captures letter codes only; symbol-first matches leave it undefined.
    const symbol = m2[0].match(/[$€£]/)?.[0] || null;
    currency = m2[1] ? m2[1].toUpperCase() : symbol || null;
    amount = parseFloat(m2[2].replace(/,/g, ""));
  }

  // Recipient
  const { name: recipientName, address: recipientAddress } = extractRecipient(text);

  // Purpose
  const { purpose, invoiceNumber } = extractPurpose(text);

  // Deadline
  const { label: deadlineLabel, date: deadlineDate } = parseDeadline(text);

  // Settlement currency + fx
  const cfg = currency ? CURRENCY_CONFIG[currency] : null;
  const requestedCurrency = cfg?.requestedCurrency || null;
  const fxRate = cfg?.fxRate || null;

  // Confidence scoring
  let confidence = 0.35;
  if (amount !== null) confidence += 0.2;
  if (currency) confidence += 0.12;
  if (recipientName || recipientAddress) confidence += 0.18;
  if (purpose) confidence += 0.08;
  if (deadlineDate) confidence += 0.05;
  confidence = Math.min(0.98, Math.round(confidence * 100) / 100);

  // Missing information
  const missingInformation: string[] = [];
  if (amount === null) missingInformation.push("Amount not specified");
  if (currency === null) missingInformation.push("Currency not specified");
  if (!recipientName && !recipientAddress) missingInformation.push("Recipient not specified");
  if (recipientName && !recipientAddress) missingInformation.push("Recipient wallet address not on file");
  if (deadlineDate === null) missingInformation.push("No deadline given");

  const detected =
    action !== "PAY_RECIPIENT" ||
    (amount !== null && currency !== null && (!!recipientName || !!recipientAddress));

  return {
    detected,
    action,
    recipientName,
    recipientAddress,
    amount,
    currency: currency ? normalizeCurrency(currency) : null,
    requestedCurrency,
    purpose,
    invoiceNumber,
    deadlineLabel,
    deadlineDate,
    confidence,
    missingInformation,
    rawInput: text,
  };
}

export { findVendorByAddress };
