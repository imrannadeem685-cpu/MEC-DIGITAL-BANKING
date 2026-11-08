import { db } from "hatchable";
import { requirePermission } from "lib/authz.js";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const profile = await requirePermission(req, res, "report_view");
  if (!profile) return;
  const from = req.query?.from || new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10);
  const to = req.query?.to || new Date().toISOString().slice(0,10);
  const totals = (await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END),0) AS income,
       COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END),0) AS expense,
       COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount WHEN transaction_type = 'expense' THEN -amount ELSE 0 END),0) AS net,
       COUNT(*)::int AS transactions
     FROM transactions
     WHERE workspace_id = $1 AND status = 'posted' AND transaction_date BETWEEN $2::date AND $3::date`,
    [profile.workspace_id, from, to]
  )).rows[0];
  const categories = (await db.query(
    `SELECT category, transaction_type, SUM(amount) AS amount, COUNT(*)::int AS count
       FROM transactions
       WHERE workspace_id = $1 AND status = 'posted' AND transaction_date BETWEEN $2::date AND $3::date
       GROUP BY category, transaction_type ORDER BY amount DESC LIMIT 20`,
    [profile.workspace_id, from, to]
  )).rows;
  const monthly = (await db.query(
    `SELECT to_char(date_trunc('month', transaction_date), 'YYYY-MM') AS month,
            SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE workspace_id = $1 AND status = 'posted' AND transaction_date BETWEEN $2::date AND $3::date
       GROUP BY 1 ORDER BY 1`,
    [profile.workspace_id, from, to]
  )).rows;
  res.json({ from, to, totals, categories, monthly });
}