# Distill Project Context

## Purpose Of This Document

This document captures the project context so another person or future agent can understand what has been built, why decisions were made, how to run it, and what remains.

## Project Identity

- Project name: Distill
- Location: `C:\Users\awake\dev\active\distill`
- Product type: local-first desktop thinking app
- Current version: 0.1.1
- Desktop target: Windows x64
- Current state: local MVP complete and installed-app verified

## Origin

The project started from the goal of building a world-class personal thinking support app.

The product direction was derived from these principles:

- Instant thought capture.
- Semantic rediscovery.
- Natural linking between notes.
- Context from projects, people, dates, and daily work.
- Long-term ownership of personal knowledge.

Benchmarks and influences:

- Obsidian: local files, ownership, links.
- Logseq: daily notes, blocks, knowledge workflows.
- Mem: search and meaning-based rediscovery.
- Reflect: calendar/people context and encrypted trust posture.
- PARA: action-oriented organization.
- Zettelkasten: atomic notes and connections.
- Local-first software: offline, ownership, portability.

## What Was Built

Distill 0.1.1 is a Tauri + React desktop app with SQLite persistence and a signed updater flow.

Implemented features:

- Inbox capture.
- Today view.
- Search.
- Projects.
- People index.
- Knowledge graph.
- Archive/restore.
- Inline edit.
- Project assignment.
- Markdown export.
- JSON export.
- Manual JSON backup.
- Automatic latest backup.
- Validated JSON restore.
- Markdown bullet import.
- First-run onboarding.
- Storage path display.
- Signed auto-update check/install flow.
- Manual update launcher fallback for newer Distill setup packages.
- English/Japanese UI.
- Windows installer.

## Installed App Status

The app has been installed and verified.

Installed paths:

```text
C:\Users\awake\AppData\Local\Distill\app.exe
C:\Users\awake\AppData\Local\Distill\uninstall.exe
C:\Users\awake\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Distill.lnk
```

Runtime data paths:

```text
C:\Users\awake\AppData\Roaming\app.distill.local\distill.sqlite3
C:\Users\awake\AppData\Roaming\app.distill.local\backups\distill-auto-backup-latest.json
```

Installed data verification:

- Projects: 3
- Blocks: 4
- Tags: 7
- Links: 7
- People: 1
- Concepts: 7
- Graph edges: 11
- Full JSON snapshots: 1

Verified user-captured block:

```text
譏取律縺ｮ莨夊ｭｰ縺ｧ [[讀懃ｴ｢菴馴ｨ転] 繧堤｢ｺ隱阪☆繧・@Aki #meeting
```

## Current Release Artifact

Installer:

```text
C:\Users\awake\dev\active\distill\src-tauri\target\release\bundle\nsis\Distill_0.1.1_x64-setup.exe
```

SHA256:

```text
5E13BA109491348C58B00A498FBFA5396CD906263A70619D3DF3F1FD77A2CC81
```

Installed executable hash differs from installer hash because it is the extracted app binary, not the installer package.

## Technical Stack

- React
- TypeScript
- Vite
- Tauri 2
- Rust
- SQLite
- SQLite FTS5
- Vitest
- Playwright
- NSIS packaging

## Important Commands

Install dependencies:

```powershell
npm install
```

Run browser dev server:

```powershell
npm run dev
```

Run desktop dev mode:

```powershell
npm run tauri:dev:windows
```

Run all verification:

```powershell
npm run check:all
```

Build Windows installer:

```powershell
npm run tauri:build:windows
```

Verify installer hash:

```powershell
Get-FileHash src-tauri\target\release\bundle\nsis\Distill_0.1.1_x64-setup.exe -Algorithm SHA256
```

## Current Test Status

Latest full verification:

- `npm test`: 17 passed.
- `npm run build`: passed.
- `npm run test:rust`: 8 passed.
- `npm run test:e2e`: 9 passed.
- `npm run check:all`: passed.
- `npm run tauri:build:windows`: passed.

E2E coverage includes:

- Japanese default UI.
- English MVP flow.
- Capture/search/graph/project/archive.
- JSON restore.
- Markdown import.
- Edit/archive/restore.
- Markdown/JSON/backup downloads.
- People index.
- Graph neighbors.
- Project assignment persistence after reload.

## Source Map

Key frontend files:

- `src/App.tsx`: application orchestration.
- `src/model.ts`: core types, extraction, local search.
- `src/repository.ts`: immutable mutations.
- `src/storage.ts`: persistence/search/graph adapter.
- `src/graph.ts`: graph modeling and neighbors.
- `src/import.ts`: validated import logic.
- `src/export.ts`: export/download logic.
- `src/i18n.ts`: English/Japanese copy.
- `src/components/`: UI panels.

Key desktop files:

- `src-tauri/src/lib.rs`: Tauri commands, SQLite persistence, FTS, graph, backups.
- `src-tauri/tauri.conf.json`: desktop packaging and app identity.

Key docs:

- `README.md`: quick project overview.
- `docs/design_blueprint.md`: product and technical design.
- `docs/project_context.md`: current context and handoff.
- `docs/roadmap.md`: phases and next work.
- `docs/storage_boundary.md`: persistence architecture.
- `docs/schema.sql`: long-term schema direction.
- `docs/release_notes_0.1.0.md`: first MVP release notes.
- `docs/release_manifest_0.1.0.json`: first MVP artifact metadata.
- `docs/release_notes_0.1.1.md`: signed updater test release notes.
- `docs/release_manifest_0.1.1.json`: signed updater test artifact metadata.
- `docs/mvp_qa_checklist.md`: QA checklist.
- `docs/installed_app_qa_2026-05-06.md`: installed app verification.

## Key Design Decisions

### Local-first over SaaS-first

Reason:

- Personal thoughts are sensitive.
- Offline speed matters.
- Long-term ownership is part of the product promise.

### Blocks as the core unit

Reason:

- Thought fragments are smaller than pages.
- Blocks can connect to projects, people, tags, concepts, and dates.

### Full-store mutation boundary for MVP

Reason:

- Easier to build safely.
- Repository functions remain pure.
- SQLite adapter can evolve behind `storage.ts`.

Tradeoff:

- Graph edges and normalized tables are regenerated on full-store saves.

### JSON restore as full replacement

Reason:

- Simple and predictable for MVP.
- Easier to validate than merge.

Tradeoff:

- Future versions should add restore preview and conflict summary.

### Markdown import as append-only

Reason:

- Lower risk than replacing the store.
- Useful for bringing in simple notes.

### Local semantic overlap before embeddings

Reason:

- Gives a better search experience without external APIs.
- Keeps app fully local.

Tradeoff:

- It is not real vector search.
- Alias coverage is limited.

## Known Limits

- Installer is unsigned.
- Windows SmartScreen trust is not solved.
- Signed Tauri auto-update is implemented locally; public distribution still requires uploading release files to the configured endpoint.
- No sync.
- No encryption.
- No embedding/vector index.
- No multi-user collaboration.
- No conflict resolution.
- Browser E2E is smoke-level, not exhaustive production regression coverage.

## Recommended Next Steps

### If continuing as a private tool

1. Use Distill daily for 7 days.
2. Capture real notes.
3. Back up JSON daily.
4. Track friction in a project called `Distill Feedback`.
5. Improve the highest-friction workflow first.

### If preparing for public distribution

1. Acquire code-signing certificate.
2. Sign installer.
3. Upload signed updater files to the release host.
4. Add crash/error reporting policy.
5. Create download page.
6. Write install/uninstall docs.

### If improving product quality

1. Implement embedding/vector retrieval.
2. Add related-note recommendations.
3. Add daily/weekly review.
4. Add restore preview/conflict summary.
5. Add user-selectable vault location.
6. Add optional encryption.

## Suggested 7-Day Dogfood Protocol

Each day:

1. Capture at least 10 thoughts.
2. Use `#tag` sparingly.
3. Use `[[concept]]` for reusable ideas.
4. Use `@person` for conversations.
5. Search for something from earlier in the day.
6. Assign at least one block to a project.
7. Archive at least one low-value block.
8. Export or back up JSON.

At the end of 7 days, answer:

- Was capture fast enough?
- Did search recover forgotten ideas?
- Did graph context help or distract?
- Did project assignment feel useful?
- Did backup/restore feel trustworthy?
- Did Japanese UI feel natural?
- What felt repetitive or risky?

## Handoff Summary

The project is ready for local private use and evaluation.

The next engineering inflection point is not more MVP polish; it is choosing one of three directions:

- Productization: signing, updates, distribution.
- Intelligence: embeddings, recommendations, reviews.
- Trust: encryption, vault selection, backup generations, restore preview.



