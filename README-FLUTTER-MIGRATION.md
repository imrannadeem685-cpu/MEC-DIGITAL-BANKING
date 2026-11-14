# Flutter migration workspace

This branch contains a separate Flutter Web + Android workspace for MEC Detail Banking System.

- Flutter app: `flutter/`
- Original MEC emblem: loaded from the existing live `mec-logo.webp` asset
- Existing API base: `https://mec-detail-banking.hatchable.site/api`
- Existing production architecture: Hatchable API runtime and managed PostgreSQL (unchanged)

GitHub Actions builds a Web release and split Android release APKs and stores them as workflow artifacts.

This is a migration preview with read-only API connectors, not a complete feature-parity replacement. Banking APIs require the existing signed-in user/session. The preview does not bypass authentication or migrate financial records. Native sign-in/session hand-off, role enforcement and read/write feature tests must pass before any production cutover.

Production source and Hatchable database are not modified on this branch.
