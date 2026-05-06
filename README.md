# Distill

Distill is a local-first personal thinking environment for capturing fragments, reconnecting them by meaning and context, and maturing them into durable knowledge.

## MVP Status

The desktop MVP is complete and buildable on Windows.

Implemented:

- Inbox capture with `#tags` and `[[links]]` extraction.
- Today view with daily-note grouping and active focus projects.
- Hybrid search with local semantic-overlap retrieval over the unlocked in-memory vault.
- Search evidence via matched fields and matched terms.
- People extraction from `@name`, `[[Person: Name]]`, and `[[People/Name]]`.
- Knowledge graph inferred from the unlocked in-memory vault.
- Graph edge filters for `all`, `project`, `person`, and `concept` relationships.
- Graph neighbor inspection for selected nodes.
- Projects, Archive, restore, inline edit, and processed/open state toggles.
- Markdown and JSON export.
- Validated JSON restore for portable backups.
- Restore preview with added/updated/removed/unchanged counts before replacing the current store.
- Markdown import for bullet-based notes.
- Manual JSON backup and encrypted vault backup.
- Manual encrypted sync packet export/import.
- Stable local device identity for sync packet source tracking.
- Sync deletion tombstones so old packets cannot resurrect permanently deleted archived blocks.
- Known device registry shown in the sync panel.
- First-run onboarding for capture/search/export workflow.
- Encrypted local vault gate with passphrase-based unlock.
- One-time migration from legacy plaintext local storage to encrypted vault storage.
- Storage path visibility in the inspector.
- English/Japanese UI switching.
- Tauri capability exposure limited to encrypted vault read/write, legacy migration read, plaintext clear, storage info, and update launch.
- React render error boundary so runtime UI failures show recovery steps instead of a blank screen.

Not included in this MVP:

- Real embedding/vector search.
- Automatic cloud sync or background multi-device replication.
- Signed installer/certificate trust.
- Production-grade multi-browser E2E coverage beyond the included Chrome smoke test.

## Development

Install dependencies:

```powershell
npm install
```

Run browser development mode:

```powershell
npm run dev
```

The app uses port `4173` to avoid collisions with other local Vite projects.

Build frontend:

```powershell
npm run build
```

## Verification

Run frontend unit tests:

```powershell
npm test
```

Run Rust/SQLite tests through the Visual Studio Build Tools environment:

```powershell
npm run test:rust
```

Run browser E2E smoke test:

```powershell
npm run test:e2e
```

Run the full local verification suite:

```powershell
npm run check:all
```

Current passing suite:

- Frontend/domain tests: 30 passed.
- Rust/SQLite tests: 11 passed.
- Browser E2E smoke tests: 10 passed.
- Production frontend build: passing.

## Desktop Shell

Tauri is initialized in `src-tauri/` and connected to the Vite app.

Desktop mode stores normal app state as an encrypted vault envelope through Tauri commands.

After unlock, search runs over the decrypted in-memory store and augments exact matches with local semantic-overlap retrieval. Persistent plaintext SQLite search indexes are no longer used by the app.

Graph data is inferred from the decrypted in-memory store after unlock.

Run desktop dev mode:

```powershell
npm run tauri:dev
```

On this Windows setup, use the Build Tools wrapper when `cargo` is not available in the default PowerShell PATH:

```powershell
npm run tauri:dev:windows
```

Build desktop bundle:

```powershell
npm run tauri:build
```

Windows Build Tools wrapper:

```powershell
npm run tauri:build:windows
```

Current Windows executable:

```text
src-tauri/target/release/app.exe
```

Current Windows installer output:

```text
src-tauri/target/release/bundle/nsis/Distill_0.1.13_x64-setup.exe
```

Installer SHA256:

```text
83CACFC5F39ED2E4679C58485536FF9E814E2B91ACD18B40C627F61045250EED
```

Signed auto-update flow:

1. Build a signed release with `npm run release:windows`.
2. Upload `release/Distill_0.1.13_x64-setup.exe`, `.sig`, and `latest.json` to the configured release endpoint.
3. Open the installed Distill desktop app.
4. Click `Check for updates` in the Inspector update section.
5. Click `Install update` when a newer signed version is available.

Manual installer fallback:

1. Build or download a newer `Distill_*_x64-setup.exe`.
2. Open the installed Distill desktop app.
3. Paste the installer path into the Inspector update section.
4. Click `Start manual update`.
5. Distill validates that the path points to a Distill setup `.exe`, starts the installer, then exits so the installer can overwrite the app.

The signed updater is implemented locally. Public distribution still requires uploading release files to the configured release host and, separately, acquiring a Windows code-signing certificate for SmartScreen trust.

Prerequisites on Windows:

- Rust toolchain (`rustc`, `cargo`) installed.
- Visual Studio Build Tools with MSVC + Windows SDK installed.

You can inspect setup status with:

```powershell
npx tauri info
```

## Roadmap

See `docs/roadmap.md` for the current phase plan toward 0.2.0 and beyond.

## Shared Handoff Docs

- `docs/design_blueprint.md`: product, UX, architecture, data model, and roadmap design.
- `docs/project_context.md`: current implementation context, verification status, installed-app QA, and next decisions.
- `docs/desktop_troubleshooting.md`: safe recovery steps for desktop blank-screen/WebView cache issues.



