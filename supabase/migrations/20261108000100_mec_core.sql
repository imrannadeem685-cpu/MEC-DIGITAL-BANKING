-- MEC Digital Banking: Supabase Postgres schema
-- Migrated from Hatchable SQL migrations. No production records are included.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sender_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_account_hint TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS receiver_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS receiver_account_hint TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transaction_time TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bill_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invoice_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ocr_text TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_transactions_sender_name
  ON transactions(workspace_id, sender_name);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_name
  ON transactions(workspace_id, receiver_name);
CREATE INDEX IF NOT EXISTS idx_transactions_bill_number
  ON transactions(workspace_id, bill_number);

CREATE TABLE IF NOT EXISTS financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  document_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL DEFAULT '',
  document_date DATE,
  due_date DATE,
  party_name TEXT NOT NULL DEFAULT '',
  reference_number TEXT NOT NULL DEFAULT '',
  amount NUMERIC(18,2),
  paid_amount NUMERIC(18,2),
  balance_due NUMERIC(18,2),
  payment_status TEXT NOT NULL DEFAULT 'unknown',
  provider_name TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'PKR',
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocr_text TEXT NOT NULL DEFAULT '',
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace_date
  ON financial_documents(workspace_id, document_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_reference
  ON financial_documents(workspace_id, reference_number);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_party
  ON financial_documents(workspace_id, party_name);


-- Supabase migration hardening:
-- All browser-side table access is denied. The MEC API Edge Function uses
-- the service role only after validating the caller's Supabase Auth token
-- and checking the caller's workspace + role permissions.
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspaces','workspace_state','user_profiles','user_invites',
    'businesses','finance_accounts','transactions','transaction_proofs',
    'audit_logs','financial_documents'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mec_no_direct_client_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY mec_no_direct_client_access ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- Private buckets; object access is brokered by the authenticated API
-- and the Edge Function's service-role key. Never set public=true.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('mec-proofs', 'mec-proofs', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('mec-documents', 'mec-documents', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
