import { db } from "hatchable";
import { requirePermission, audit } from "lib/authz.js";

export const access = "user";
export const methods = ["GET", "POST", "PUT"];

export default async function (req, res) {
  const profile = await requirePermission(req, res, req.method === "GET" ? "business_view" : "business_manage");
  if (!profile) return;

  if (req.method === "GET") {
    const rows = (await db.query(
      "SELECT b.id, b.name, b.notes, b.active, b.created_at, (SELECT count(*)::int FROM transactions t WHERE t.business_id = b.id AND t.status = 'posted') AS transaction_count FROM businesses b WHERE b.workspace_id = $1 ORDER BY b.active DESC, b.name",
      [profile.workspace_id]
    )).rows;
    return res.json({ businesses: rows });
  }

  const body = req.body || {};
  if (req.method === "POST") {
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Business name is required." });
    const row = (await db.query(
      "INSERT INTO businesses (workspace_id, name, notes, created_by) VALUES ($1,$2,$3,$4) RETURNING id, name, notes, active",
      [profile.workspace_id, name, String(body.notes || "").trim(), profile.user_id]
    )).rows[0];
    await audit(profile, "business_created", "business", row.id, { name });
    return res.status(201).json({ business: row });
  }

  const id = String(body.id || "");
  if (!id) return res.status(400).json({ error: "Business ID is required." });
  const row = (await db.query(
    "UPDATE businesses SET name = COALESCE($3,name), notes = COALESCE($4,notes), active = COALESCE($5,active) WHERE id = $1 AND workspace_id = $2 RETURNING id, name, notes, active",
    [id, profile.workspace_id, body.name ? String(body.name).trim() : null, body.notes !== undefined ? String(body.notes).trim() : null, typeof body.active === "boolean" ? body.active : null]
  )).rows[0];
  if (!row) return res.status(404).json({ error: "Business not found." });
  await audit(profile, "business_updated", "business", id, { active: row.active });
  res.json({ business: row });
}