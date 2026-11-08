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