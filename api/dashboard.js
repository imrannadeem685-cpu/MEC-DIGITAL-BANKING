import { db } from "hatchable";
import { requirePermission } from "lib/authz.js";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const profile = await requirePermission(req, res, "dashboard_view");
  if (!profile) return;

  const summary = (await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END),0) AS total_income,
       COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END),0) AS total_expense,
       COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount WHEN t.transaction_type = 'expense' THEN -t.amount ELSE 0 END),0) AS net_cashflow,
       COUNT(*)::int AS transaction_count
     FROM transactions t
     WHERE t.workspace_id = $1 AND t.status = 'posted'`,
    [profile.workspace_id]
  )).rows[0];

  const month = (await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END),0) AS income,
       COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END),0) AS expense,
       COUNT(*)::int AS count
     FROM transactions
     WHERE workspace_id = $1 AND status = 'posted'
       AND transaction_date >= date_trunc('month', CURRENT_DATE)::date`,
    [profile.workspace_id]
  )).rows[0];

  const assets = (await db.query(
    `SELECT COALESCE(SUM(a.opening_balance + COALESCE(x.delta,0)),0) AS total_balance
       FROM finance_accounts a
       LEFT JOIN LATERAL (
         SELECT SUM(CASE
           WHEN t.transaction_type = 'income' AND t.to_account_id = a.id THEN t.amount
           WHEN t.transaction_type = 'expense' AND t.from_account_id = a.id THEN -t.amount
           WHEN t.transaction_type = 'transfer' AND t.to_account_id = a.id THEN t.amount
           WHEN t.transaction_type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
           ELSE 0 END) AS delta
         FROM transactions t WHERE t.workspace_id = a.workspace_id AND t.status = 'posted'
           AND (t.from_account_id = a.id OR t.to_account_id = a.id)
       ) x ON true
      WHERE a.workspace_id = $1 AND a.active = true`,
    [profile.workspace_id]
  )).rows[0];

  const recent = (await db.query(
    `SELECT t.id, t.transaction_type, t.scope, t.amount, t.category, t.counterparty, t.description, t.transaction_date,
            fa.name AS from_account_name, ta.name AS to_account_name, t.status
       FROM transactions t
       LEFT JOIN finance_accounts fa ON fa.id = t.from_account_id
       LEFT JOIN finance_accounts ta ON ta.id = t.to_account_id
      WHERE t.workspace_id = $1 AND t.status = 'posted'
      ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT 8`,
    [profile.workspace_id]
  )).rows;

  const monthly = (await db.query(
    `SELECT to_char(m.month_start, 'Mon') AS month,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END),0) AS income,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END),0) AS expense
       FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month') AS m(month_start)
       LEFT JOIN transactions t ON t.workspace_id = $1 AND t.status = 'posted'
         AND date_trunc('month', t.transaction_date) = m.month_start
      GROUP BY m.month_start ORDER BY m.month_start`,
    [profile.workspace_id]
  )).rows;

  res.json({ summary, month, assets, recent, monthly });
}