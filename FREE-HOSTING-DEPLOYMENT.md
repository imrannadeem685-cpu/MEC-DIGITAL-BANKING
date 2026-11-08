# MEC Digital Banking — Free Hosting Migration

## Free-only architecture
- Static frontend: Cloudflare Pages (Free)
- Database, OTP authentication, private file storage and API runtime: Supabase Free
- OCR: Tesseract.js in the browser. No paid AI provider is called by this build.
- Source control: private GitHub repository

## What this migration branch contains
- `supabase/migrations/20261108000100_mec_core.sql`: original MEC financial schema with RLS enabled, direct client access denied, and private document/proof buckets.
- `supabase/functions/mec-api/index.ts`: Supabase Edge Function API foundation.
- `supabase/config.toml`: function deployment configuration.
- `public/mec-config.js`: public-only Supabase URL/key placeholders.
- `wrangler.toml`: Cloudflare Pages static output configuration.

## Setup steps (account owner must perform)
1. Create a Supabase project on the Free plan. Do not enter a card or upgrade.
2. In Supabase SQL Editor, run the migration file above.
3. Deploy the function:
   - Install Supabase CLI locally.
   - Run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`.
   - Set secrets: `supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...`.
   - Deploy: `supabase functions deploy mec-api --no-verify-jwt`.
4. Set the Auth site URL and allowed redirect URLs to the final Cloudflare Pages domain.
5. Configure `public/mec-config.js` with the Supabase project URL, public anon/publishable key, and Edge Function URL.
6. Publish the `public/` folder with Cloudflare Pages Free.
7. Test first-owner bootstrap, pending invitations, roles, account balances, transaction creation/edit/void, exports, private document upload/download, and cross-user isolation.

## Critical safeguards
- Never commit the Supabase service-role key. It bypasses RLS.
- Never put bank statements, payment slips, real customer data, or database exports in GitHub.
- Storage buckets remain private. Downloads must be short-lived signed URLs after workspace authorization.
- The first authenticated account becomes owner. Create the first account only after migration and confirm that it is the intended owner.
- Keep the Hatchable application online until migration and tests are completed.
- Free plans have quotas and may pause inactive projects. No uptime, unlimited storage, email delivery or OCR accuracy guarantee is implied.

## Known incomplete items in this initial migration foundation
- Frontend auth wiring and final deployment config are still required.
- The full API route parity (especially invitations, proof upload, OCR metadata, and document filters) must be completed and tested before production use.
- This is not a live replacement yet. No production financial records have been migrated.
