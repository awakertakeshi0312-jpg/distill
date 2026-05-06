# Distill Security Assessment - 2026-05-06

## Scope

This assessment covers the current local-first Distill MVP:

- Tauri desktop shell
- React/Vite frontend
- encrypted local vault persistence
- legacy plaintext migration path
- browser/PWA preview
- signed Windows updater
- GitHub Releases updater feed
- manual encrypted sync packet export/import with apply preview

It does not certify the app for regulated data, medical data, legal privilege, or enterprise compliance.

## Current Security Posture

### Strengths

- Local-first storage: notes are stored locally and are not sent to a backend by default.
- Normal local persistence is encrypted after vault creation/unlock.
- The encrypted vault uses PBKDF2 SHA-256 and AES-256-GCM.
- App startup gates note access behind a vault passphrase.
- Existing known plaintext local stores are migrated into the encrypted vault and cleared.
- Search and graph run from the decrypted in-memory store, not from a persistent plaintext SQLite index.
- No remote scripts or CDN runtime dependencies are loaded by the app shell.
- Tauri command exposure is explicitly limited through capabilities.
- Signed updater is configured with Tauri updater signatures.
- Release feed is HTTPS-hosted on GitHub Releases.
- Export/import and sync packet exchange are explicit and user-triggered.
- Tauri updater is registered only for desktop builds.
- Manual sync packets use record-level encrypted records and deletion tombstones.
- Sync packet imports show an apply preview before changing the vault.
- Known sync devices now keep `lastPacketHash`, and newer packets must continue the known checkpoint chain.

### Changes Applied Through 0.1.16

- Added startup vault gate for create/unlock.
- Added normal encrypted local persistence under `distill.vault.v1`.
- Added one-time migration from legacy plaintext store to encrypted vault.
- Added `clear_plain_store` to remove known plaintext normalized tables, legacy JSON, and old plaintext auto backup.
- Removed plaintext save/search/graph commands from the frontend capability allow-list.
- Switched app search and graph to the unlocked in-memory store.
- Updated E2E tests to assert encrypted vault persistence does not contain plaintext.
- Added vault passphrase change flow.
- Added auto-lock settings and lock-on-hidden behavior.
- Added E2E coverage proving old passphrase no longer unlocks after passphrase change.
- Added manual encrypted sync packet export/import.
- Added local device identity and known-device registry.
- Added deletion tombstones so stale packets cannot resurrect permanently deleted archived blocks.
- Added restore preview before JSON or encrypted vault replacement.
- Added a React render error boundary so UI failures show recovery steps instead of a blank screen.
- Added unsupported-envelope and tampered-payload encrypted vault tests.
- Added stale sync packet rejection based on known source-device `lastPacketAt`.
- Added encrypted sync packet apply preview with add/update/skip/delete counts before merging.
- Added chained sync checkpoint validation using packet hashes.
- Added sync device trust revocation and revoked-device packet rejection.
- Added explicit desktop sync-folder packet exchange with Tauri-side file name, schema, and size validation.
- Added sync-folder safety scan that decrypts packet candidates in memory, classifies revoked-source/checkpoint-risk/invalid packets before preview, and keeps quarantine available.
- Added recommended preview guard that auto-opens only one unambiguous safe packet and never auto-applies sync.
- Added encrypted pre-sync recovery snapshots so sync is not applied unless a recovery point is saved first.
- Added in-app listing and Restore preview for saved encrypted pre-sync recovery snapshots.

## Findings

### P1: Passphrase lives in app memory while unlocked

Distill keeps the passphrase available during the unlocked session so autosave and updater flows can persist the encrypted vault.

Recommended remediation:

- Replace passphrase-in-state with a session key model.
- Derive and hold a non-exportable CryptoKey where possible.
- Evaluate Tauri Stronghold or platform keyring for optional convenience unlock.
- Keep lock-on-idle defaults conservative and add OS-native idle integration later.

### P1: Whole-store vault persistence still limits automatic sync

The current encrypted vault protects local data at rest, and manual sync packets use record-level encrypted records. Normal vault persistence is still a whole-store envelope, which is simple and safe for local MVP use but not ideal for automatic multi-device sync.

Recommended remediation:

- Move normal persistence toward record-level encrypted blocks/projects.
- Add encrypted append-only sync logs.
- Keep plaintext sync metadata minimal.
- Define rollback/replay protection before automatic sync.

### P2: Browser/PWA mode still depends on localStorage

The browser preview stores the encrypted envelope in localStorage. Content is encrypted, but localStorage can be deleted, replaced, or copied by anything with browser profile access.

Recommended remediation:

- Treat PWA mode as a preview until IndexedDB + better key/session handling is implemented.
- Add backup/export prompts on mobile.
- Consider native mobile for stronger platform storage.

### P2: Manual update installer fallback launches a local executable

The manual fallback intentionally starts a local installer path. Filename validation is stricter, but filename validation is not cryptographic verification.

Recommended remediation:

- Prefer signed automatic updater for normal updates.
- Keep manual fallback behind a clear warning.
- Later verify SHA256 or Authenticode signature before launching the fallback installer.

### P2: Import limits are basic

JSON, Markdown, encrypted vault, and sync packet imports have a 5 MB file cap and schema validation. JSON/encrypted vault restore and encrypted sync packet import now show a preview before changing local data, but there is still no full resource exhaustion policy.

Recommended remediation:

- Add maximum block/project counts per import.
- Add corrupted encrypted vault test cases.
- Add richer conflict review for restore and sync merges.

### P3: GitHub Pages web preview has no sync or account boundary

The web preview is static and local-only. That is safe from a backend perspective, but users may misunderstand it as synced.

Recommended remediation:

- Label web preview as this-device-only.
- Add backup/export onboarding for mobile.
- Add sync only after record-level encryption and identity model are designed.

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

The current implementation follows these Tauri security practices:

- Capabilities constrain frontend access to native APIs.
- Remote API access is not enabled.
- CSP is enabled and restricts remote content.
- Updater permission is scoped to desktop capability.
- Plaintext save/search/graph commands are not exposed to the frontend capability.

References:

- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/security/csp/

## Release Gate

Before distributing a new public build:

1. Run `npm run check:all`.
2. Run `npm run security:audit`.
3. Build with `npm run release:windows`.
4. Run `npm run release:check`.
5. Verify `release/latest.json`:
   - no BOM
   - `platforms.windows-x86_64`
   - signature matches `.sig`
   - URL points to the matching installer.
6. Upload installer, `.sig`, and `latest.json` to GitHub Release.
7. Test update from the previous installed version.

## Next Security Milestones

1. Add device removal and trust revocation flow.
2. Add OS-native idle/sleep integration and optional keyring convenience unlock.
3. Add automatic encrypted folder sync only after recovery drills are documented and exercised.
4. Add signed checkpoint or trusted-device verification for higher assurance sync.
5. Add user-selectable vault location and backup rotation.
