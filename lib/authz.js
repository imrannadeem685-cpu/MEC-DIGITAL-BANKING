import { db } from "hatchable";

const ROLE_DEFAULTS = {
  owner: ["*"],
  accountant: ["dashboard_view","transaction_view","transaction_create","transaction_edit","transaction_void","account_view","account_manage","business_view","business_manage","report_view","proof_upload","proof_view","export_view","team_view"],
  cashier: ["dashboard_view","transaction_view","transaction_create","account_view","business_view","proof_upload","proof_view"],
  staff: ["dashboard_view","transaction_view","account_view","business_view","proof_view"],
  viewer: ["dashboard_view","transaction_view","account_view","business_view","report_view","proof_view"]
};

export async function resolveProfile(req) {
  const user = req.user;
  if (!user?.id || !user?.email) throw new Error("Signed-in user context is required.");

  let state = (await db.query("SELECT workspace_id, owner_user_id FROM workspace_state WHERE id = 1")).rows[0];

  if (!state) {
    const created = (await db.query(
      "INSERT INTO workspaces (name) VALUES ($1) RETURNING id",
      ["MEC Detail Banking System"]
    )).rows[0];
    await db.query(
      "INSERT INTO workspace_state (id, workspace_id, owner_user_id) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING",
      [created.id, user.id]
    );
    state = (await db.query("SELECT workspace_id, owner_user_id FROM workspace_state WHERE id = 1")).rows[0];
  }

  let profile = (await db.query(
    "SELECT user_id, workspace_id, email, full_name, role, permissions, status FROM user_profiles WHERE user_id = $1",
    [user.id]
  )).rows[0];

  if (!profile && state.owner_user_id === user.id) {
    profile = (await db.query(
      "INSERT INTO user_profiles (user_id, workspace_id, email, full_name, role, status) VALUES ($1,$2,lower($3),$4,'owner','active') ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING user_id, workspace_id, email, full_name, role, permissions, status",
      [user.id, state.workspace_id, user.email, user.name || ""]
    )).rows[0];
  }

  if (!profile) {
    const invite = (await db.query(
      "SELECT id, role, permissions FROM user_invites WHERE workspace_id = $1 AND email = lower($2)",
      [state.workspace_id, user.email]
    )).rows[0];

    if (invite) {
      profile = (await db.query(
        "INSERT INTO user_profiles (user_id, workspace_id, email, full_name, role, permissions, status) VALUES ($1,$2,lower($3),$4,$5,$6::jsonb,'active') ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING user_id, workspace_id, email, full_name, role, permissions, status",
        [user.id, state.workspace_id, user.email, user.name || "", invite.role, JSON.stringify(invite.permissions || {})]
      )).rows[0];
      await db.query("DELETE FROM user_invites WHERE id = $1", [invite.id]);
      await db.query(
        "INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, details) VALUES ($1,$2,'invite_accepted','user',$2,$3::jsonb)",
        [state.workspace_id, user.id, JSON.stringify({ email: user.email, role: invite.role })]
      );
    } else {
      profile = (await db.query(
        "INSERT INTO user_profiles (user_id, workspace_id, email, full_name, role, status) VALUES ($1,$2,lower($3),$4,'staff','pending') ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING user_id, workspace_id, email, full_name, role, permissions, status",
        [user.id, state.workspace_id, user.email, user.name || ""]
      )).rows[0];
    }
  }

  return profile;
}

export function can(profile, permission) {
  if (!profile || profile.status !== "active") return false;
  if (profile.role === "owner") return true;
  if (Object.prototype.hasOwnProperty.call(profile.permissions || {}, permission)) {
    return profile.permissions[permission] === true;
  }
  const allowed = ROLE_DEFAULTS[profile.role] || [];
  return allowed.includes("*") || allowed.includes(permission);
}

export async function requirePermission(req, res, permission) {
  let profile;
  try {
    profile = await resolveProfile(req);
  } catch (error) {
    res.status(401).json({ error: "Sign in required." });
    return null;
  }
  if (profile.status !== "active") {
    res.status(403).json({ error: "Your access is pending owner approval.", status: profile.status });
    return null;
  }
  if (permission && !can(profile, permission)) {
    res.status(403).json({ error: "You do not have permission for this action." });
    return null;
  }
  return profile;
}

export async function audit(profile, action, entityType, entityId, details = {}) {
  await db.query(
    "INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6::jsonb)",
    [profile.workspace_id, profile.user_id, action, entityType, String(entityId || ""), JSON.stringify(details)]
  );
}

export function rolePermissions() {
  return ROLE_DEFAULTS;
}