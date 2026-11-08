# MEC Digital Banking System

MEC Digital Banking System is the finance workspace for managing business accounts, transactions, payment proofs, financial documents, reports and team access.

## Live application

- **Production app:** https://mec-detail-banking.hatchable.site/
- **Application status:** Active
- **Current production version:** 7
- **Currency:** PKR
- **MEC project source:** This repository

The live application remains hosted on Hatchable. The GitHub repository is the version-controlled source copy and backup; it is not the production hosting service.

## Production architecture

- **Frontend:** HTML, CSS and JavaScript in `public/`
- **Backend:** Hatchable serverless API runtime
- **Database:** Hatchable-managed PostgreSQL
- **Authentication, file storage and AI services:** Hatchable-managed services
- **API handlers:** `api/`
- **Shared authorization:** `lib/authz.js`
- **Database migrations:** `migrations/`

## Main capabilities in the source

- Business and finance accounts
- Transactions and cash-flow records
- Payment proofs and financial documents
- Document and payment-slip scanning
- Dashboard and reports
- Team access, role checks and audit logs

## Deployment and branch safety

**Do not publish this repository with GitHub Pages expecting the banking application to work.** GitHub Pages can serve static files, but it cannot run the backend API handlers or provide the managed database, authentication, storage and AI services used by this application.

A move away from Hatchable would require a separately planned and tested backend migration, authentication migration, database migration, file-storage migration and security review. Do not replace the active production app until those tests pass.

The `main` branch is the source copy of the active Hatchable application. The `free-hosting-migration` branch is an experimental alternative-hosting branch and includes Supabase-related files; it is **not** the production branch and must not be treated as an approved production migration.

## Security

- Keep API keys, passwords, access tokens and provider secrets out of Git.
- Never commit real bank statements, payment screenshots, customer records or production database exports.
- Use the hosting platform's secret manager for any required credentials.
- Keep the source repository private unless its contents have been reviewed and public release is explicitly approved.

## Brand asset

The MEC finance emblem is stored at `public/mec-logo.webp` and is referenced by the login and dashboard pages.
