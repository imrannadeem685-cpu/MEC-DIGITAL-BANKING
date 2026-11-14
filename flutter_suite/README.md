# MEC Flutter Suite — hosted launcher

This Flutter suite provides a mobile Android companion and a Flutter Web launch hub for the six active MEC workspaces.

## Direct web access

The deployment publishes the hub at the repository GitHub Pages URL under `/flutter/`. Individual Flutter launcher pages are published beneath `/flutter/apps/<workspace-id>/`. Android APKs are published under `/flutter/downloads/`.

## Important migration boundary

This is a safe Phase 1 Flutter migration. On Android, each Flutter app hosts the existing secure Hatchable workspace in an Android WebView. On Web, Flutter presents the workspace launch UI and opens the existing workspace in the browser. This preserves the existing sign-in, access permissions, APIs, file storage and PostgreSQL business records.

It is **not yet a full native rewrite of the six business applications**. A full native migration requires porting each existing screen and workflow, matching its API contract, reproducing upload and document scanning flows, and testing every user role. The six live Hatchable apps remain the production source of truth until that separate migration is complete.

## Workspaces

- Email Marketing — https://i8miz8.hatchable.site/
- MEC Detail Banking — https://mec-detail-banking.hatchable.site/
- MEC Group — https://mec-group-corporate.hatchable.site/
- MEC Notification Center — https://mec-notification.hatchable.site/
- MEC Owner Control Center — https://mec-owner-control.hatchable.site/
- PRIME TRADE — https://prime-trade-web-app.hatchable.site/

## Brand and data safety

The Flutter companion references the existing published MEC and PRIME TRADE logos. It does not overwrite source logo assets, migrate databases, or save users' Hatchable passwords.

## Build checks

The GitHub Actions deployment runs `flutter pub get`, `flutter analyze`, `flutter test`, Web release builds and Android release APK builds for each of the six workspaces plus the MEC hub. It then publishes the Flutter Web files and Android APKs to the GitHub Pages site.
