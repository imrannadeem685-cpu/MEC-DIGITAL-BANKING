CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'MEC Detail Banking System',
  currency TEXT NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  owner_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','accountant','cashier','staff','viewer')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('accountant','cashier','staff','viewer')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL CHECK (account_type IN ('bank','wallet')),
  account_number_hint TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','business','shared')),
  business_id UUID REFERENCES businesses(id),
  currency TEXT NOT NULL DEFAULT 'PKR',
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income','expense','transfer')),
  scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','business')),
  business_id UUID REFERENCES businesses(id),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  from_account_id UUID REFERENCES finance_accounts(id),
  to_account_id UUID REFERENCES finance_accounts(id),
  category TEXT NOT NULL DEFAULT 'General',
  counterparty TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
  void_reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_account_id IS NULL OR to_account_id IS NULL OR from_account_id <> to_account_id),
  CHECK (
    (transaction_type = 'income' AND to_account_id IS NOT NULL AND from_account_id IS NULL) OR
    (transaction_type = 'expense' AND from_account_id IS NOT NULL AND to_account_id IS NULL) OR
    (transaction_type = 'transfer' AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS transaction_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_workspace ON user_profiles(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_invites_email ON user_invites(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_businesses_workspace ON businesses(workspace_id, active);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_workspace ON finance_accounts(workspace_id, active);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON transactions(workspace_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_account_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_account_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(workspace_id, reference);
CREATE INDEX IF NOT EXISTS idx_proofs_transaction ON transaction_proofs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_date ON audit_logs(workspace_id, created_at DESC);