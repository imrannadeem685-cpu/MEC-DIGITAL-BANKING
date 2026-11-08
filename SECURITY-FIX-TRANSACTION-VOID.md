# Security fix: transaction void permission

## Change
- The transaction endpoint now selects authorization based on the requested action.
- GET requires `transaction_view`.
- POST requires `transaction_create`.
- PUT with `action: "void"` requires `transaction_void`.
- Other PUT edits require `transaction_edit`.
- The permission check happens before reading or modifying the transaction record.

## Expected role behavior from the current role defaults
- Owner: allowed by owner wildcard.
- Accountant: allowed (`transaction_void` is included).
- Cashier: denied by default.
- Staff: denied by default.
- Viewer: denied by default.

Explicit per-user permission overrides in `user_profiles.permissions` still apply according to the authorization helper.

## Validation status
- Source change committed to main.
- Read-back from GitHub confirmed the new permission selection is present.
- Static source review only. No live Hatchable runtime authorization test was performed in this commit.
- Before production use, test a dedicated test transaction: owner/accountant void should succeed; cashier/staff/viewer void should return 403 unless explicitly granted; unauthorized users should not alter transaction status.
- Do not use a real financial transaction as a test record.
