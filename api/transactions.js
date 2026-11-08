import { db } from "hatchable";
import { requirePermission, audit } from "lib/authz.js";

export const access = "user";
export const methods = ["GET", "POST", "PUT"];

export default async function (req, res) {
  const permission = req.method === "GET"
    ? "transaction_view"
    : req.method === "POST"
      ? "transaction_create"
      : req.body?.action === "void"
        ? "transaction_void"
        : "transaction_edit";
  const profile = await requirePermission(req, res, permission);
  if (!profile) return;

  if (req.method === "GET") {
    const clauses = ["t.workspace_id = $1"];
    const params = [profile.workspace_id];
    const add = (sql, value) => { params.push(value); clauses.push(sql.replace("?", "$" + params.length)); };
    if (req.query?.from) add("t.transaction_date >= ?::date", req.query.from);
    if (req.query?.to) add("t.transaction_date <= ?::date", req.query.to);
    if (req.query?.type && ["income","expense","transfer"].includes(req.query.type)) add("t.transaction_type = ?", req.query.type);
    if (req.query?.scope && ["personal","business"].includes(req.query.scope)) add("t.scope = ?", req.query.scope);
    if (req.query?.account) {
      params.push(req.query.account);
      clauses.push("(t.from_account_id = $" + params.length + " OR t.to_account_id = $" + params.length + ")");
    }
    if (req.query?.q) {
      params.push("%" + String(req.query.q).slice(0,100) + "%");
      clauses.push("(t.description ILIKE $" + params.length + " OR t.counterparty ILIKE $" + params.length + " OR t.reference ILIKE $" + params.length + " OR t.category ILIKE $" + params.length + " OR t.sender_name ILIKE $" + params.length + " OR t.receiver_name ILIKE $" + params.length + " OR t.provider_name ILIKE $" + params.length + " OR t.bill_number ILIKE $" + params.length + " OR t.invoice_number ILIKE $" + params.length + ")");
    }
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit) || 150));
    const rows = (await db.query(
      `SELECT t.id, t.transaction_type, t.scope, t.business_id, b.name AS business_name, t.amount, t.from_account_id, fa.name AS from_account_name, t.to_account_id, ta.name AS to_account_name, t.category, t.counterparty, t.reference, t.description, t.transaction_date, t.status, t.void_reason,
              t.sender_name, t.sender_account_hint, t.receiver_name, t.receiver_account_hint, t.provider_name, t.transaction_time,
              t.fee_amount, t.tax_amount, t.bill_number, t.invoice_number, t.payment_status, t.scan_data, t.ocr_text,
              t.created_by, t.created_at, t.updated_at,
              COALESCE((SELECT json_agg(json_build_object('id',p.id,'original_filename',p.original_filename,'content_type',p.content_type,'byte_size',p.byte_size)) FROM transaction_proofs p WHERE p.transaction_id = t.id),'[]'::json) AS proofs
         FROM transactions t
         LEFT JOIN businesses b ON b.id = t.business_id
         LEFT JOIN finance_accounts fa ON fa.id = t.from_account_id
         LEFT JOIN finance_accounts ta ON ta.id = t.to_account_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ${limit}`,
      params
    )).rows;
    return res.json({ transactions: rows });
  }

  const body = req.body || {};
  if (req.method === "POST") {
    const type = body.transaction_type;
    const scope = body.scope || "personal";
    const amount = Number(body.amount);
    const date = body.transaction_date || new Date().toISOString().slice(0,10);
    const fromId = body.from_account_id || null;
    const toId = body.to_account_id || null;
    if (!["income","expense","transfer"].includes(type) || !["personal","business"].includes(scope) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid transaction type, scope and amount greater than zero." });
    }
    if ((type === "income" && (!toId || fromId)) || (type === "expense" && (!fromId || toId)) || (type === "transfer" && (!fromId || !toId || fromId === toId))) {
      return res.status(400).json({ error: "Select the correct source and destination accounts." });
    }
    if (scope === "business" && !body.business_id) return res.status(400).json({ error: "Choose a business for this transaction." });
    const ids = [fromId, toId].filter(Boolean);
    if (ids.length) {
      const matched = (await db.query(
        "SELECT count(*)::int AS n FROM finance_accounts WHERE workspace_id = $1 AND active = true AND id = ANY($2::uuid[])",
        [profile.workspace_id, ids]
      )).rows[0].n;
      if (matched !== ids.length) return res.status(400).json({ error: "One of the selected accounts is unavailable." });
    }
    if (scope === "business") {
      const business = (await db.query("SELECT id FROM businesses WHERE id = $1 AND workspace_id = $2 AND active = true", [body.business_id, profile.workspace_id])).rows[0];
      if (!business) return res.status(400).json({ error: "Business not found." });
    }
    const feeAmount = Number(body.fee_amount || 0);
    const taxAmount = Number(body.tax_amount || 0);
    if (!Number.isFinite(feeAmount) || feeAmount < 0 || !Number.isFinite(taxAmount) || taxAmount < 0) {
      return res.status(400).json({ error: "Fee and tax must be zero or greater." });
    }
    const reference = String(body.reference || "").trim().slice(0,120);
    if (reference) {
      const duplicate = (await db.query(
        "SELECT id FROM transactions WHERE workspace_id = $1 AND reference = $2 AND amount = $3 AND transaction_date = $4::date AND status = 'posted' LIMIT 1",
        [profile.workspace_id, reference, amount, date]
      )).rows[0];
      if (duplicate) return res.status(409).json({ error: "A transaction with the same reference, amount and date already exists.", duplicate_id: duplicate.id });
    }
    const row = (await db.query(
      `INSERT INTO transactions (
         workspace_id, transaction_type, scope, business_id, amount, from_account_id, to_account_id, category, counterparty, reference, description, transaction_date, created_by, updated_by,
         sender_name, sender_account_hint, receiver_name, receiver_account_hint, provider_name, transaction_time, fee_amount, tax_amount, bill_number, invoice_number, payment_status, scan_data, ocr_text
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26)
       RETURNING id, transaction_type, scope, amount, transaction_date, status`,
      [
        profile.workspace_id, type, scope, scope === "business" ? body.business_id : null, amount, fromId, toId,
        String(body.category || "General").trim().slice(0,80), String(body.counterparty || "").trim().slice(0,120),
        reference, String(body.description || "").trim().slice(0,1000), date, profile.user_id,
        String(body.sender_name || "").trim().slice(0,160), String(body.sender_account_hint || "").trim().slice(0,40),
        String(body.receiver_name || "").trim().slice(0,160), String(body.receiver_account_hint || "").trim().slice(0,40),
        String(body.provider_name || "").trim().slice(0,100), String(body.transaction_time || "").trim().slice(0,8),
        feeAmount, taxAmount, String(body.bill_number || "").trim().slice(0,120), String(body.invoice_number || "").trim().slice(0,120),
        String(body.payment_status || "").trim().slice(0,30), JSON.stringify(body.scan_data && typeof body.scan_data === "object" ? body.scan_data : {}),
        String(body.ocr_text || "").slice(0,30000)
      ]
    )).rows[0];
    await audit(profile, "transaction_created", "transaction", row.id, { type, amount, scope, reference });
    return res.status(201).json({ transaction: row });
  }

  const id = String(body.id || "");
  const action = body.action;
  const existing = (await db.query(
    "SELECT id, transaction_type, amount, transaction_date, status, category, counterparty, reference, description, business_id, scope, sender_name, sender_account_hint, receiver_name, receiver_account_hint, provider_name, transaction_time, fee_amount, tax_amount, bill_number, invoice_number, payment_status, scan_data, ocr_text FROM transactions WHERE id = $1 AND workspace_id = $2",
    [id, profile.workspace_id]
  )).rows[0];
  if (!existing) return res.status(404).json({ error: "Transaction not found." });
  if (action === "void") {
    const reason = String(body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "A reason is required to void a transaction." });
    if (existing.status === "voided") return res.status(409).json({ error: "This transaction is already voided." });
    const row = (await db.query(
      "UPDATE transactions SET status = 'voided', void_reason = $3, updated_by = $4, updated_at = now() WHERE id = $1 AND workspace_id = $2 RETURNING id, status, void_reason",
      [id, profile.workspace_id, reason.slice(0,500), profile.user_id]
    )).rows[0];
    await audit(profile, "transaction_voided", "transaction", id, { reason, previous_amount: existing.amount });
    return res.json({ transaction: row });
  }

  const category = body.category === undefined ? existing.category : String(body.category).trim().slice(0,80);
  const counterparty = body.counterparty === undefined ? existing.counterparty : String(body.counterparty).trim().slice(0,120);
  const reference = body.reference === undefined ? existing.reference : String(body.reference).trim().slice(0,120);
  const description = body.description === undefined ? existing.description : String(body.description).trim().slice(0,1000);
  const date = body.transaction_date === undefined ? existing.transaction_date : body.transaction_date;
  const amount = body.amount === undefined ? Number(existing.amount) : Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Amount must be greater than zero." });
  const feeAmount = body.fee_amount === undefined ? Number(existing.fee_amount || 0) : Number(body.fee_amount || 0);
  const taxAmount = body.tax_amount === undefined ? Number(existing.tax_amount || 0) : Number(body.tax_amount || 0);
  if (!Number.isFinite(feeAmount) || feeAmount < 0 || !Number.isFinite(taxAmount) || taxAmount < 0) return res.status(400).json({ error: "Fee and tax must be zero or greater." });
  const scanData = body.scan_data === undefined ? (existing.scan_data || {}) : body.scan_data;
  const row = (await db.query(
    `UPDATE transactions SET
       amount = $3, category = $4, counterparty = $5, reference = $6, description = $7, transaction_date = $8::date,
       sender_name = $10, sender_account_hint = $11, receiver_name = $12, receiver_account_hint = $13,
       provider_name = $14, transaction_time = $15, fee_amount = $16, tax_amount = $17, bill_number = $18,
       invoice_number = $19, payment_status = $20, scan_data = $21::jsonb, ocr_text = $22,
       updated_by = $9, updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, transaction_type, amount, category, counterparty, reference, description, transaction_date, status,
                 sender_name, receiver_name, provider_name, fee_amount, tax_amount, bill_number, invoice_number, payment_status, scan_data`,
    [
      id, profile.workspace_id, amount, category, counterparty, reference, description, date, profile.user_id,
      body.sender_name === undefined ? existing.sender_name : String(body.sender_name).trim().slice(0,160),
      body.sender_account_hint === undefined ? existing.sender_account_hint : String(body.sender_account_hint).trim().slice(0,40),
      body.receiver_name === undefined ? existing.receiver_name : String(body.receiver_name).trim().slice(0,160),
      body.receiver_account_hint === undefined ? existing.receiver_account_hint : String(body.receiver_account_hint).trim().slice(0,40),
      body.provider_name === undefined ? existing.provider_name : String(body.provider_name).trim().slice(0,100),
      body.transaction_time === undefined ? existing.transaction_time : String(body.transaction_time).trim().slice(0,8),
      feeAmount, taxAmount,
      body.bill_number === undefined ? existing.bill_number : String(body.bill_number).trim().slice(0,120),
      body.invoice_number === undefined ? existing.invoice_number : String(body.invoice_number).trim().slice(0,120),
      body.payment_status === undefined ? existing.payment_status : String(body.payment_status).trim().slice(0,30),
      JSON.stringify(scanData && typeof scanData === "object" ? scanData : {}),
      body.ocr_text === undefined ? existing.ocr_text : String(body.ocr_text).slice(0,30000)
    ]
  )).rows[0];
  await audit(profile, "transaction_updated", "transaction", id, { before: existing, after: row });
  res.json({ transaction: row });
}
