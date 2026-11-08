import { db } from "hatchable";
import { requirePermission, audit } from "lib/authz.js";

export const access = "user";
export const methods = ["GET", "POST", "PUT"];

export default async function (req, res) {
  const profile = await requirePermission(req, res, req.method === "GET" ? "account_view" : "account_manage");
  if (!profile) return;

  if (req.method === "GET") {
    const rows = (await db.query(
      `SELECT a.id, a.name, a.institution, a.account_type, a.account_number_hint, a.scope,
              a.business_id, b.name AS business_name, a.currency, a.opening_balance,
              a.opening_date, a.notes, a.active, a.created_at,
              a.opening_balance + COALESCE((
                SELECT SUM(
                  CASE
                    WHEN t.transaction_type = 'income' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.transaction_type = 'expense' AND t.from_account_id = a.id THEN -t.amount
                    WHEN t.transaction_type = 'transfer' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.transaction_type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
                    ELSE 0
                  END
                ) FROM transactions t
                WHERE t.workspace_id = a.workspace_id AND t.status = 'posted'
                  AND (t.from_account_id = a.id OR t.to_account_id = a.id)
              ), 0) AS current_balance
         FROM finance_accounts a LEFT JOIN businesses b ON b.id = a.business_id
        WHERE a.workspace_id = $1
        ORDER BY a.active DESC, a.account_type, a.name`,
      [profile.workspace_id]
    )).rows;
    return res.json({ accounts: rows });
  }

  const body = req.body || {};
  if (req.method === "POST") {
    const name = String(body.name || "").trim();
    const type = body.account_type;
    const scope = body.scope || "personal";
    const opening = Number(body.opening_balance || 0);
    if (!name || !["bank", "wallet"].includes(type) || !["personal", "business", "shared"].includes(scope) || !Number.isFinite(opening)) {
      return res.status(400).json({ error: "Enter a valid name, account type, scope and opening balance." });
    }
    const businessId = body.business_id || null;
    if (scope === "business" && !businessId) return res.status(400).json({ error: "Choose a business for this account." });
    if (businessId) {
      const ok = (await db.query("SELECT id FROM businesses WHERE id = $1 AND workspace_id = $2", [businessId, profile.workspace_id])).rows[0];
      if (!ok) return res.status(400).json({ error: "Business not found." });
    }
    const row = (await db.query(
      `INSERT INTO finance_accounts (workspace_id, name, institution, account_type, account_number_hint, scope, business_id, currency, opening_balance, opening_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PKR',$8,COALESCE($9::date,CURRENT_DATE),$10,$11) RETURNING id, name, account_type`,
      [profile.workspace_id, name, String(body.institution || "").trim(), type, String(body.account_number_hint || "").trim().slice(0, 12), scope, businessId, opening, body.opening_date || null, String(body.notes || "").trim(), profile.user_id]
    )).rows[0];
    await audit(profile, "account_created", "account", row.id, { name: row.name, account_type: row.account_type });
    return res.status(201).json({ account: row });
  }

  const id = String(body.id || "");
  if (!id) return res.status(400).json({ error: "Account ID is required." });
  const row = (await db.query(
    "UPDATE finance_accounts SET name = COALESCE($3,name), institution = COALESCE($4,institution), notes = COALESCE($5,notes), active = COALESCE($6,active) WHERE id = $1 AND workspace_id = $2 RETURNING id, name, active",
    [id, profile.workspace_id, body.name ? String(body.name).trim() : null, body.institution !== undefined ? String(body.institution).trim() : null, body.notes !== undefined ? String(body.notes).trim() : null, typeof body.active === "boolean" ? body.active : null]
  )).rows[0];
  if (!row) return res.status(404).json({ error: "Account not found." });
  await audit(profile, "account_updated", "account", id, { active: row.active });
  res.json({ account: row });
}