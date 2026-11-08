# MEC Digital Banking System

Private source repository for the MEC Detail Banking System.

## Project source
- Original application: https://mec-detail-banking.hatchable.site/
- Source platform: Hatchable (version 7 at the time of export)
- Currency default: PKR
- Backend: Hatchable serverless API runtime and managed PostgreSQL
- Frontend: static HTML, CSS and JavaScript
- Database schema: migrations/

## Included
- API routes for accounts, businesses, dashboard, team access, audit logs, documents, proofs, reports, scanning and transactions
- Shared authorization helpers
- SQL schema migrations
- Frontend pages and styling
- Hatchable runtime manifest

## Important deployment note
This repository is source control, not a hosted application. The API handlers import the Hatchable SDK and depend on Hatchable's managed database, authentication, storage and AI services. GitHub Pages cannot run these backend routes. A move to another host requires a compatible backend/database/auth/storage migration and testing.

## Secrets and financial data
- Do not commit API keys, passwords, access tokens, .env files, real bank statements, payment slips, customer records or production database exports.
- Configure provider keys through the target platform's secret manager.
- Review all permissions and access controls before inviting users or making any app public.

## Export note
The source files were copied from the active Hatchable project. The platform-generated AGENTS.md file was intentionally excluded. The logo image is not included in this text-source export and must be transferred separately as a binary asset.
