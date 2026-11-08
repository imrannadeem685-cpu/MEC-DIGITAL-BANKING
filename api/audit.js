import { db } from "hatchable";
import { requirePermission } from "lib/authz.js";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const profile = await requirePermission(req, res, "audit_view");
  if (!profile) return;
  const rows = (await db.query(
    "SELECT id, actor_user_id, action, entity_type, entity_id, details, created_at FROM audit_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200",
    [profile.workspace_id]
  )).rows;
  res.json({ logs: rows });
}