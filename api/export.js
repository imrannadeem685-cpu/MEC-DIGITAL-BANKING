import { db } from "hatchable";
import { requirePermission } from "lib/authz.js";

export const access = "user";
export const methods = ["GET"];

function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export default async function (req, res) {
  const profile = await requirePermission(req, res, "export_view");
  if (!profile) return;
  const rows = (await db.query(
    `SELECT t.id, t.transaction_date, t.transaction_type, t.scope, b.name AS business, t.category,
            t.amount, fa.name AS from_account, ta.name AS to_account, t.counterparty,
            t.reference, t.description, t.status, t.void_reason
       FROM transactions t
       LEFT JOIN businesses b ON b.id = t.business_id
       LEFT JOIN finance_accounts fa ON fa.id = t.from_account_id
       LEFT JOIN finance_accounts ta ON ta.id = t.to_account_id
      WHERE t.workspace_id = $1
      ORDER BY t.transaction_date DESC, t.created_at DESC`,
    [profile.workspace_id]
  )).rows;
  const headers = ["ID","Date","Type","Scope","Business","Category","Amount_PKR","From_Account","To_Account","Counterparty","Reference","Description","Status","Void_Reason"];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push([
    r.id,r.transaction_date,r.transaction_type,r.scope,r.business,r.category,r.amount,
    r.from_account,r.to_account,r.counterparty,r.reference,r.description,r.status,r.void_reason
  ].map(csvCell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=mec-transactions.csv");
  res.send("\uFEFF" + lines.join("\r\n"));
}