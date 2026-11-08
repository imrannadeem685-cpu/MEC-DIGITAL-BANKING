# GitHub Hosting Review — MEC Digital Banking

Review date: 2026-11-08

## Current production

- Live application: https://mec-detail-banking.hatchable.site/
- Hatchable project: MEC Detail Banking System
- Production version checked: 7
- Project status checked: active
- Production API routes reported active: accounts, admin users, audit, bootstrap, businesses, dashboard, documents, export, proofs, reports, scan and transactions.
- GitHub source repository: https://github.com/imrannadeem685-cpu/MEC-DIGITAL-BANKING
- Repository visibility at review: private
- Production branch: `main`

## Why a direct GitHub Pages publish would not work

1. GitHub Pages serves static assets. It does not execute this repository's Hatchable serverless API handlers or provide its managed PostgreSQL database, authentication, storage or AI services.
2. The production frontend in `public/app.js` sends requests to same-origin paths such as `/api/accounts`, `/api/businesses`, `/api/dashboard`, `/api/transactions` and `/api/documents`.
3. The frontend's API helper uses `fetch("/api/" + path, { credentials: "same-origin", ... })`. The proof links also use same-origin `/api/proofs/...` paths.
4. When the same static files are served from a `github.io` address, those `/api/*` requests go to GitHub Pages, not the Hatchable production API. Login/session handling is also tied to the existing application origin. Therefore the dashboard may load as static HTML, but banking data operations, authentication and document proof routes will not work correctly without an engineered integration and testing.

## GitHub Pages account requirement

GitHub's documentation states that GitHub Pages is available for public repositories on GitHub Free. Private repositories require an eligible paid plan. Publishing a Pages site also makes the site publicly available, even if the source repository remains private on an eligible plan.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Migration branch warning

The `free-hosting-migration` branch contains placeholder Supabase URL and public-key settings in `public/mec-config.js`. Those values are intentionally placeholders, not working credentials. This branch is not the production branch and must not be deployed as a working alternative without a separately authorized backend migration and full testing.

## Safe next step

Keep the active Hatchable application online and keep the source repository private for now. A real GitHub-hosted production version requires either:
- explicit approval and an eligible GitHub Pages setup plus a redesigned, tested API/authentication integration; or
- a separately authorized migration to a host that can run the backend, database, authentication and file storage.

Do not publish the production source or change its visibility without the owner's explicit approval. Do not delete, replace or disable the live Hatchable production project as part of this review.
