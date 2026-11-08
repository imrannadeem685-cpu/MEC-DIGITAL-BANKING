import { db } from "hatchable";
import { resolveProfile } from "lib/authz.js";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const profile = await resolveProfile(req);
  const state = (await db.query(
    "SELECT w.id, w.name, w.currency, s.owner_user_id FROM workspaces w JOIN workspace_state s ON s.workspace_id = w.id WHERE s.id = 1"
  )).rows[0];

  const counts = profile.status === "active" ? (await db.query(
    "SELECT (SELECT count(*)::int FROM finance_accounts WHERE workspace_id = $1 AND active = true) AS accounts, (SELECT count(*)::int FROM businesses WHERE workspace_id = $1 AND active = true) AS businesses, (SELECT count(*)::int FROM transactions WHERE workspace_id = $1 AND status = 'posted') AS transactions",
    [profile.workspace_id]
  )).rows[0] : { accounts: 0, businesses: 0, transactions: 0 };

  res.json({
    profile: {
      user_id: profile.user_id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      permissions: profile.permissions || {},
      status: profile.status
    },
    workspace: state,
    counts
  });
}