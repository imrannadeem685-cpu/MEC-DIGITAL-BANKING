import { db } from "hatchable";
import { requirePermission, audit, rolePermissions } from "lib/authz.js";

export const access = "user";
export const methods = ["GET", "POST", "PATCH"];

const ALLOWED_ROLES = new Set(["accountant","cashier","staff","viewer"]);

export default async function (req, res) {
  const profile = await requirePermission(req, res, req.method === "GET" ? "team_view" : "team_manage");
  if (!profile) return;

  if (req.method === "GET") {
    const users = (await db.query(
      "SELECT user_id, email, full_name, role, permissions, status, created_at FROM user_profiles WHERE workspace_id = $1 ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, email",
      [profile.workspace_id]
    )).rows;
    const invitations = (await db.query(
      "SELECT id, email, role, permissions, created_at FROM user_invites WHERE workspace_id = $1 ORDER BY created_at DESC",
      [profile.workspace_id]
    )).rows;
    return res.json({ users, invitations, role_permissions: rolePermissions() });
  }

  const body = req.body || {};
  if (req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "staff");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: "Choose accountant, cashier, staff or viewer." });
    const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
    const existing = (await db.query(
      "SELECT user_id FROM user_profiles WHERE workspace_id = $1 AND email = $2",
      [profile.workspace_id, email]
    )).rows[0];
    if (existing) {
      const updated = (await db.query(
        "UPDATE user_profiles SET role = $3, permissions = $4::jsonb, status = 'active', updated_at = now() WHERE user_id = $1 AND workspace_id = $2 RETURNING email, role, status",
        [existing.user_id, profile.workspace_id, role, JSON.stringify(permissions)]
      )).rows[0];
      await audit(profile, "team_user_activated", "user", existing.user_id, { email, role });
      return res.json({ user: updated, invited: false });
    }
    const invite = (await db.query(
      "INSERT INTO user_invites (workspace_id, email, role, permissions, invited_by) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (workspace_id,email) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions, invited_by = EXCLUDED.invited_by, created_at = now() RETURNING id, email, role, created_at",
      [profile.workspace_id, email, role, JSON.stringify(permissions), profile.user_id]
    )).rows[0];
    await audit(profile, "team_invite_created", "invitation", invite.id, { email, role });
    return res.status(201).json({ invitation: invite, invited: true });
  }

  const userId = String(body.user_id || "");
  if (!userId || userId === profile.user_id) return res.status(400).json({ error: "Choose another team member." });
  const target = (await db.query(
    "SELECT user_id, email, role FROM user_profiles WHERE user_id = $1 AND workspace_id = $2",
    [userId, profile.workspace_id]
  )).rows[0];
  if (!target) return res.status(404).json({ error: "Team member not found." });
  if (target.role === "owner") return res.status(403).json({ error: "The owner role cannot be changed here." });
  const role = body.role === undefined ? target.role : String(body.role);
  const status = body.status === undefined ? null : String(body.status);
  if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: "Invalid role." });
  if (status && !["active","pending","suspended"].includes(status)) return res.status(400).json({ error: "Invalid account status." });
  const permissions = body.permissions && typeof body.permissions === "object" ? JSON.stringify(body.permissions) : null;
  const updated = (await db.query(
    "UPDATE user_profiles SET role = $3, status = COALESCE($4,status), permissions = COALESCE($5::jsonb,permissions), updated_at = now() WHERE user_id = $1 AND workspace_id = $2 RETURNING user_id, email, role, permissions, status",
    [userId, profile.workspace_id, role, status, permissions]
  )).rows[0];
  await audit(profile, "team_user_updated", "user", userId, { role, status });
  res.json({ user: updated });
}