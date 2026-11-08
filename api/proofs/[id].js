import { db, storage } from "hatchable";
import { requirePermission } from "lib/authz.js";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const profile = await requirePermission(req, res, "proof_view");
  if (!profile) return;
  const row = (await db.query(
    "SELECT storage_key FROM transaction_proofs WHERE id = $1 AND workspace_id = $2",
    [req.params.id, profile.workspace_id]
  )).rows[0];
  if (!row) return res.status(404).json({ error: "Proof not found." });
  const url = await storage.url(row.storage_key, { ttl: 60 });
  res.redirect(302, url);
}