import { ai, db } from "hatchable";
import { requirePermission } from "lib/authz.js";

export const access = "user";
export const methods = ["POST"];

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function validMagic(buf, mime) {
  if (mime === "image/jpeg") return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png") return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === "image/webp") return buf.length > 12 && buf.toString("ascii",0,4) === "RIFF" && buf.toString("ascii",8,12) === "WEBP";
  if (mime === "application/pdf") return buf.length > 5 && buf.toString("ascii",0,5) === "%PDF-";
  return false;
}

function scrubText(value) {
  return String(value || "")
    .split(/\r?\n/)
    .filter(line => !/\b(otp|one[ -]?time password|pin code|\bpin\b|cvv|cvc|password|passcode|security code)\b/i.test(line))
    .join("\n")
    .replace(/(?<!\d)(?:\+?92[ -]?|0)3\d{2}[ -]?\d{7}(?!\d)/g, match => "•••• " + match.replace(/\D/g,"").slice(-4))
    .replace(/(?:\d[ -]?){13,19}/g, (match, offset, full) => { const before=full.slice(Math.max(0,offset-65),offset); return /(?:transaction|reference|utr|rrn|trace|txn|trx|receipt)\s*(?:id|no|number|#)?\s*[:#\-]?\s*$/i.test(before) ? match.trim() : "•••• •••• •••• " + match.replace(/\D/g,"").slice(-4); })
    .slice(0, 20000);
}

function parseJson(text) {
  const cleaned = String(text || "").trim().replace(/^\x60\x60\x60(?:json)?/i,"").replace(/\x60\x60\x60$/,"").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The scan model did not return structured JSON.");
  return JSON.parse(cleaned.slice(start,end+1));
}

function cleanString(value, max=240) {
  if (value === null || value === undefined) return "";
  return scrubText(String(value).trim()).slice(0,max);
}

function sanitizeValue(value, depth=0) {
  if (depth > 5 || value === null || value === undefined) return null;
  if (typeof value === "string") return scrubText(value).slice(0,500);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0,60).map(v => sanitizeValue(v,depth+1));
  if (typeof value === "object") {
    const out={};
    for (const [key,val] of Object.entries(value).slice(0,60)) {
      const safeKey=scrubText(key).slice(0,80);
      if (safeKey) out[safeKey]=sanitizeValue(val,depth+1);
    }
    return out;
  }
  return null;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g,""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function cleanReference(value, max=120) {
  if (value === null || value === undefined) return "";
  // Reference/UTR/RRN values are not card numbers when the model has explicitly
  // classified them into these fields. Preserve long numeric IDs for reconciliation.
  return String(value).replace(/[\r\n]/g," ").trim().slice(0,max);
}

export default async function (req, res) {
  const profile = await requirePermission(req, res, "proof_upload");
  if (!profile) return;

  const file = (req.files || []).find(f => f.field === "file");
  if (!file) return res.status(400).json({ error: "Choose a bill, payment screenshot or bank slip." });
  if (file.buffer.length > MAX_BYTES) return res.status(413).json({ error: "File is over 5 MB. Compress it and try again." });
  if (!ALLOWED.has(file.contentType) || !validMagic(file.buffer, file.contentType)) {
    return res.status(415).json({ error: "Only valid JPG, PNG, WebP or PDF files are supported." });
  }

  try {
    const accounts = (await db.query(
      "SELECT id, name, institution, account_type, account_number_hint FROM finance_accounts WHERE workspace_id = $1 AND active = true ORDER BY name LIMIT 80",
      [profile.workspace_id]
    )).rows;

    const accountContext = accounts.map(a => ({
      id: a.id,
      name: a.name,
      provider: a.institution,
      type: a.account_type,
      last_digits: a.account_number_hint
    }));

    const prompt = `You are a meticulous financial-document OCR and extraction engine for a Pakistan-based personal/business finance ledger.
Inspect the attached image or PDF carefully, line by line. It may be a bank transfer receipt, JazzCash/Easypaisa/wallet screenshot, ATM/deposit slip, utility bill, paid bill receipt, supplier invoice, shop receipt, cheque/deposit document or another financial record. The document may contain English, Urdu, Roman Urdu, mixed text, low contrast, or rotated text.

Return ONLY one valid JSON object. Do not invent, infer, or silently correct any value. Use null for unavailable numeric/date/time values and empty string for unavailable text. All amounts must be numeric PKR values without commas. Dates must be YYYY-MM-DD. Times must be 24-hour HH:MM or empty string.

Read and distinguish carefully:
- actual amount transferred/paid vs invoice total, subtotal, balance due, cash tendered, change, available balance and account balance;
- sender/payer vs receiver/payee vs merchant/biller;
- payment successful vs pending vs failed vs reversed vs bill unpaid;
- transaction/reference/trace/RRN/UTR IDs vs consumer number vs bill number vs invoice number;
- fee/service charge, tax/GST, discount, subtotal, total and due amount.
For invoices and bills, capture biller, bill/invoice number, consumer/reference number, billing period, due date, line items with description, quantity, unit price and line total, subtotal, tax, discount, total and paid/due amount where visible.
For payment slips, capture the payer/sender and payee/receiver names and masked account/mobile hints (last four digits only), bank/wallet/provider, transaction date and time, reference IDs, amount, fee, tax, status, channel and any visible narration.
The full_text field MUST be a near-verbatim, line-by-line transcription of ALL legible non-secret text on the complete document, preserving the original reading order, headings, labels, transaction table rows, amounts, references, sender/receiver names, footer notes, bill line items, and printed status messages. Do NOT give a summary in full_text and do NOT omit any readable financial detail. Keep line breaks where possible. If a word is truly unreadable, mark it [illegible] in place rather than guessing. Keep the structured JSON fields as well as this complete plain-text transcription.

CRITICAL PRIVACY RULE: Never extract or return any PIN, OTP, password, passcode, CVV/CVC, full debit/credit card number, or full bank-account number. Do not include these in full_text. Mask account/mobile/card-like numbers to last four digits only. Ignore security codes even if visible.

Determine direction from the document's explicit wording and account matches only:
- "debit" = money left the user's registered account;
- "credit" = money arrived in the user's registered account;
- "internal_transfer" = between two registered accounts;
- "third_party" = payment between parties but whether it belongs in this user's ledger is not clear;
- "unknown" = cannot determine.
Never assume the person in the sender field is the app owner. Use the registered-account list below only when the document's provider and last digits clearly match. Return exact account IDs only for high-confidence matches. If not certain, leave match IDs empty and add a warning.
Registered accounts (IDs are options, never fabricate an ID): ${JSON.stringify(accountContext)}

Output exactly this shape:
{
 "document_type":"payment_receipt|bank_slip|wallet_receipt|utility_bill|invoice|retail_receipt|deposit_slip|other",
 "direction":"debit|credit|internal_transfer|third_party|unknown",
 "payment_status":"successful|pending|failed|reversed|unpaid|partial|unknown",
 "transaction_amount":null,
 "currency":"PKR",
 "subtotal":null,
 "tax_amount":null,
 "fee_amount":null,
 "discount_amount":null,
 "invoice_total":null,
 "balance_due":null,
 "transaction_date":"",
 "transaction_time":"",
 "transaction_reference":"",
 "rrn_or_trace":"",
 "bill_number":"",
 "invoice_number":"",
 "consumer_or_customer_reference":"",
 "billing_period":"",
 "due_date":"",
 "sender_name":"",
 "sender_account_hint":"",
 "receiver_name":"",
 "receiver_account_hint":"",
 "merchant_or_biller":"",
 "provider_name":"",
 "channel":"",
 "narration":"",
 "matched_from_account_id":"",
 "matched_to_account_id":"",
 "line_items":[{"description":"","quantity":null,"unit_price":null,"line_total":null}],
 "other_details":{},
 "field_confidence":{"transaction_amount":0,"transaction_date":0,"transaction_reference":0,"sender_name":0,"receiver_name":0,"payment_status":0},
 "warnings":[],
 "full_text":""
}
Use confidence from 0 to 1 based only on visual evidence. Add warnings for blurred, cut-off, inconsistent, missing, or conflicting important details. If the image contains multiple transactions, say so in warnings and do not combine their amounts.`;

    const providerResult = await ai.fetch({
      provider: "google",
      path: "/v1beta/models/gemini-3.5-flash-lite:generateContent",
      body: {
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: file.contentType, data: file.buffer.toString("base64") } }
          ]
        }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" }
      },
      purpose: "financial-document-scan",
      timeoutMs: 50000
    });

    if (!providerResult.ok) {
      const detail = await providerResult.text().catch(() => "");
      console.error("financial document scan provider error", providerResult.status, detail.slice(0,500));
      if (providerResult.status === 412) {
        return res.status(424).json({ error: "AI smart scan needs an active Google AI provider connection or available Hatchable AI credit. Open Hatchable Settings → AI to connect a provider or check the available credit. You can still save the original document manually." });
      }
      return res.status(502).json({ error: "Smart scan is not available right now. Check the AI provider setup/credit in Hatchable Settings, or use the manual fields and attach the proof." });
    }

    const responseData = await providerResult.json();
    const responseText = (responseData.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n");
    const raw = parseJson(responseText);

    const extraction = {
      document_type: cleanString(raw.document_type,60) || "other",
      direction: ["debit","credit","internal_transfer","third_party","unknown"].includes(raw.direction) ? raw.direction : "unknown",
      payment_status: ["successful","pending","failed","reversed","unpaid","partial","unknown"].includes(raw.payment_status) ? raw.payment_status : "unknown",
      transaction_amount: cleanNumber(raw.transaction_amount),
      currency: cleanString(raw.currency,8) || "PKR",
      subtotal: cleanNumber(raw.subtotal),
      tax_amount: cleanNumber(raw.tax_amount),
      fee_amount: cleanNumber(raw.fee_amount),
      discount_amount: cleanNumber(raw.discount_amount),
      invoice_total: cleanNumber(raw.invoice_total),
      balance_due: cleanNumber(raw.balance_due),
      transaction_date: cleanString(raw.transaction_date,10),
      transaction_time: cleanString(raw.transaction_time,8),
      transaction_reference: cleanReference(raw.transaction_reference,120),
      rrn_or_trace: cleanReference(raw.rrn_or_trace,120),
      bill_number: cleanReference(raw.bill_number,120),
      invoice_number: cleanReference(raw.invoice_number,120),
      consumer_or_customer_reference: cleanReference(raw.consumer_or_customer_reference,120),
      billing_period: cleanString(raw.billing_period,120),
      due_date: cleanString(raw.due_date,10),
      sender_name: cleanString(raw.sender_name,160),
      sender_account_hint: cleanString(raw.sender_account_hint,40),
      receiver_name: cleanString(raw.receiver_name,160),
      receiver_account_hint: cleanString(raw.receiver_account_hint,40),
      merchant_or_biller: cleanString(raw.merchant_or_biller,180),
      provider_name: cleanString(raw.provider_name,100),
      channel: cleanString(raw.channel,80),
      narration: cleanString(raw.narration,500),
      matched_from_account_id: accounts.some(a => a.id === raw.matched_from_account_id) ? raw.matched_from_account_id : "",
      matched_to_account_id: accounts.some(a => a.id === raw.matched_to_account_id) ? raw.matched_to_account_id : "",
      line_items: Array.isArray(raw.line_items) ? raw.line_items.slice(0,100).map(x => ({
        description: cleanString(x.description,240),
        quantity: cleanNumber(x.quantity),
        unit_price: cleanNumber(x.unit_price),
        line_total: cleanNumber(x.line_total)
      })) : [],
      other_details: raw.other_details && typeof raw.other_details === "object" && !Array.isArray(raw.other_details) ? sanitizeValue(raw.other_details) : {},
      field_confidence: raw.field_confidence && typeof raw.field_confidence === "object" ? raw.field_confidence : {},
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(x => cleanString(x,240)).filter(Boolean).slice(0,30) : [],
      full_text: scrubText(raw.full_text)
    };

    if (extraction.transaction_amount === null && extraction.invoice_total === null) extraction.warnings.push("No clear payable/paid amount was found.");
    if (!extraction.transaction_date) extraction.warnings.push("Transaction or bill date was not clearly detected.");
    if (extraction.direction === "unknown") extraction.warnings.push("Payment direction is unclear; choose income, expense or transfer manually.");
    if (extraction.payment_status === "unknown") extraction.warnings.push("Payment status needs manual confirmation.");
    const reference = extraction.transaction_reference || extraction.rrn_or_trace;
    let possibleDuplicate = null;
    if (reference && extraction.transaction_amount !== null && extraction.transaction_date) {
      possibleDuplicate = (await db.query(
        "SELECT id, transaction_type, amount, transaction_date, counterparty FROM transactions WHERE workspace_id = $1 AND reference = $2 AND amount = $3 AND transaction_date = $4::date AND status = 'posted' LIMIT 1",
        [profile.workspace_id, reference, extraction.transaction_amount, extraction.transaction_date]
      )).rows[0] || null;
    }

    res.json({
      extraction,
      possible_duplicate: possibleDuplicate,
      scanned_at: new Date().toISOString(),
      engine: "Gemini vision document extraction"
    });
  } catch (error) {
    console.error("financial document scan failed", error?.message || error);
    if (error?.code === "setup_required" || error?.status === 412 || /\\b412\\b|no google key configured|setup_required|AI credit is used up/i.test(String(error?.message||""))) {
      return res.status(424).json({ error: "Smart scan needs an active Google AI provider key or available Hatchable AI credit. Open the project Setup → AI section to connect it. Until then, image files can use basic local OCR and PDF files can still be saved manually as documents." });
    }
    return res.status(502).json({ error: "The document could not be fully scanned. Try a clearer image/PDF, or enter the details manually and keep the proof attached." });
  }
}