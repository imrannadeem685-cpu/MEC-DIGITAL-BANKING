import { db, storage } from "hatchable";
import { requirePermission, audit } from "lib/authz.js";

export const access = "user";
export const methods = ["POST"];

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);

function validMagic(buf, mime) {
  if (mime === "image/jpeg") return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png") return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === "image/webp") return buf.length > 12 && buf.toString("ascii",0,4) === "RIFF" && buf.toString("ascii",8,12) === "WEBP";
  if (mime === "application/pdf") return buf.length > 5 && buf.toString("ascii",0,5) === "%PDF-";
  return false;
}

export default async function (req, res) {
  const profile = await requirePermission(req, res, "proof_upload");
  if (!profile) return;
  const transactionId = String(req.body?.transaction_id || "");
  if (!transactionId) return res.status(400).json({ error: "Transaction ID is required." });
  const transaction = (await db.query(
    "SELECT id FROM transactions WHERE id = $1 AND workspace_id = $2",
    [transactionId, profile.workspace_id]
  )).rows[0];
  if (!transaction) return res.status(404).json({ error: "Transaction not found." });

  const file = (req.files || []).find(f => f.field === "file");
  if (!file) return res.status(400).json({ error: "Choose an image or PDF file." });
  if (file.buffer.length > MAX_BYTES) return res.status(413).json({ error: "File is too large. Maximum size is 5 MB." });
  if (!MIME.has(file.contentType) || !validMagic(file.buffer, file.contentType)) {
    return res.status(415).json({ error: "Only valid JPG, PNG, WebP or PDF files are accepted." });
  }

  const ext = file.contentType === "image/jpeg" ? "jpg" : file.contentType === "application/pdf" ? "pdf" : file.contentType.split("/")[1];
  const key = `proofs/${profile.workspace_id}/${transactionId}/${crypto.randomUUID()}.${ext}`;
  await storage.put(key, file.buffer, file.contentType);
  const proof = (await db.query(
    "INSERT INTO transaction_proofs (workspace_id, transaction_id, storage_key, original_filename, content_type, byte_size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, transaction_id, original_filename, content_type, byte_size, created_at",
    [profile.workspace_id, transactionId, key, String(file.filename || "proof").slice(0,200), file.contentType, file.buffer.length, profile.user_id]
  )).rows[0];
  await audit(profile, "proof_uploaded", "transaction", transactionId, { proof_id: proof.id, filename: proof.original_filename });
  res.status(201).json({ proof });
}