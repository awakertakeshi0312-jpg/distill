# Distill Security Assessment - 2026-05-06

## Scope

This assessment covers the current local-first Distill MVP:

- Tauri desktop shell
- React/Vite frontend
- SQLite persistence through Rust commands
- browser/localStorage fallback
- signed Windows updater
- GitHub Releases updater feed
- new PWA/mobile web preview path

It does not certify the app for regulated data, medical data, legal privilege, or enterprise compliance.

## Current Security Posture

### Strengths

- Local-first storage: notes are stored locally, not sent to a backend by default.
- No remote scripts or CDN runtime dependencies are loaded by the app shell.
- Signed updater is configured with Tauri updater signatures.
- Release feed is HTTPS-hosted on GitHub Releases.
- Export/import is explicit and user-triggered.
- Tauri updater is registered only for desktop builds.
- Browser/PWA mode falls back to localStorage and does not expose desktop installer launching.

### Changes Applied In This Pass

- Enabled Tauri Content Security Policy instead of `csp: null`.
- Restricted Tauri command exposure at build time with an explicit command allow-list.
- Limited the default Tauri capability to desktop platforms.
- Kept updater permission desktop-only through the desktop capability file.
- Tightened manual update installer validation to the exact `Distill_<version>_x64-setup.exe` shape.
- Added `npm run security:audit`.
- Added PWA manifest and service worker for mobile web usage.
- Added GitHub Pages workflow for a web preview build.
- Added encrypted portable vault backups using passphrase-derived AES-GCM.

## Findings

### P1: Local notes are not encrypted at rest

Distill currently stores the primary data in SQLite and automatic JSON backup files in the app data directory. Anyone with OS-level access to the user profile or disk can potentially read the data.

Encrypted `.distill-vault.json` backups are now available, but the active local database is still plaintext.

Recommended remediation:

- Add passphrase-based local vault encryption before saving store JSON.
- Evaluate Tauri Stronghold for secret storage, especially if later storing sync credentials.
- Add a recovery/export path before enabling encryption by default.

### P1: Browser/PWA mode uses localStorage

The web/mobile preview uses browser localStorage. This is convenient for testing on a phone, but localStorage is not appropriate for high-sensitivity long-term private notes.

Recommended remediation:

- Treat PWA mode as a preview until IndexedDB + encryption is implemented.
- Warn users in docs/UI that browser data is device/browser-local and not encrypted by Distill.
- Add explicit backup/export prompts on mobile.

### P2: Manual update installer fallback launches a local executable

The manual fallback is useful for recovery, but it intentionally starts a local installer path. Filename validation is now stricter, but filename validation is not cryptographic verification.

Recommended remediation:

- Prefer signed automatic updater for normal updates.
- Keep manual fallback behind a clear warning.
- Later verify SHA256 or signature before launching the fallback installer.

### P2: Import size and content limits are not enforced

JSON and Markdown imports validate shape, but there is no explicit size cap. A very large import can cause memory/performance problems.

Recommended remediation:

- Add client-side file size limits.
- Add maximum block/project counts per import.
- Add streaming or chunked import only if needed later.

### P2: No app-level lock screen

Anyone with access to the unlocked OS session can open Distill.

Recommended remediation:

- Add optional app lock.
- On desktop, use OS credential APIs or Stronghold-backed unlock state.
- On mobile, consider biometric plugin after mobile native path is chosen.

### P3: GitHub Pages web preview has no sync or account boundary

The web preview is static and local-only. That is safe from a backend perspective, but users may misunderstand it as synced.

Recommended remediation:

- Label web preview as "this device only".
- Add backup/export onboarding for mobile.
- Add sync only after encryption and identity model are designed.

## Dependency Audit

Run on 2026-05-06:

- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- `cargo-audit`: not installed in this environment.

Recommended recurring checks:

- `npm run security:audit`
- `cargo install cargo-audit --locked`
- `cargo audit`
- Review Tauri, React, Vite, and rusqlite updates before every release.

## Tauri Security Notes

The current implementation follows these Tauri security recommendations:

- Capabilities are used to constrain frontend access to native APIs.
- Remote API access is not enabled.
- CSP is enabled and restricts remote content.
- Updater permission is scoped to desktop capability.

References:

- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/security/csp/

## Release Gate

Before distributing a new public build:

1. Run `npm run check:all`.
2. Run `npm run security:audit`.
3. Build with `npm run release:windows`.
4. Verify `release/latest.json`:
   - no BOM
   - `platforms.windows-x86_64`
   - signature matches `.sig`
   - URL points to the matching installer.
5. Upload installer, `.sig`, and `latest.json` to GitHub Release.
6. Test update from the previous installed version.

## Next Security Milestones

1. Add explicit web/PWA local-only warning.
2. Add SHA256 check for manual installer fallback.
3. Add app lock.
4. Move active local persistence to encrypted vault storage.
5. Add sync only after encrypted local persistence is complete.
