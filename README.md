# Distill

Distill is a local-first personal thinking environment for capturing fragments, reconnecting them by meaning and context, and maturing them into durable knowledge.

## MVP Status

The desktop MVP is complete and buildable on Windows.

Implemented:

- Inbox capture with `#tags` and `[[links]]` extraction.
- Today view with daily-note grouping and active focus projects.
- Hybrid search with SQLite FTS5, local semantic-overlap retrieval, and in-memory browser fallback.
- Search evidence via matched fields and matched terms.
- People extraction from `@name`, `[[Person: Name]]`, and `[[People/Name]]`.
- Knowledge graph with SQLite-derived graph snapshots in Tauri mode.
- Browser fallback graph inferred from the loaded store.
- Graph edge filters for `all`, `project`, `person`, and `concept` relationships.
- Graph neighbor inspection for selected nodes.
- Projects, Archive, restore, inline edit, and processed/open state toggles.
- Markdown and JSON export.
- Validated JSON restore for portable backups.
- Markdown import for bullet-based notes.
- Manual JSON backup and automatic latest local backup.
- First-run onboarding for capture/search/export workflow.
- Storage path visibility in the inspector.
- English/Japanese UI switching.
- Tauri command failure fallback to local browser-compatible persistence/search behavior.

Not included in this MVP:

- Real embedding/vector search.
- Cloud sync or multi-device replication.
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

- Frontend/domain tests: 17 passed.
- Rust/SQLite tests: 8 passed.
- Browser E2E smoke tests: 9 passed.
- Production frontend build: passing.

## Desktop Shell

Tauri is initialized in `src-tauri/` and connected to the Vite app.

Desktop mode stores app state in a local SQLite database through Tauri commands.

Desktop search uses SQLite FTS5 over block content, tags, and links, then augments results with local semantic-overlap retrieval. Browser mode keeps the same UI contract and falls back to client-side matching with the same local semantic aliases.

Desktop graph reads use SQLite-derived `people`, `concepts`, and `graph_edges` tables. Browser mode falls back to inferred graph data.

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
src-tauri/target/release/bundle/nsis/Distill_0.1.1_x64-setup.exe
```

Installer SHA256:

```text
5E13BA109491348C58B00A498FBFA5396CD906263A70619D3DF3F1FD77A2CC81
```

Signed auto-update flow:

1. Build a signed release with `npm run release:windows`.
2. Upload `release/Distill_0.1.1_x64-setup.exe`, `.sig`, and `latest.json` to the configured release endpoint.
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



