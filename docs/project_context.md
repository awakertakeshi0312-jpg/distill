# Distill Project Context

## Purpose

This document is the handoff context for Distill so another person or future agent can understand the current state, run the project, and continue safely.

## Project Identity

- Project name: Distill
- Location: `C:\Users\awake\dev\active\distill`
- Repository: `https://github.com/awakertakeshi0312-jpg/distill`
- Product type: local-first desktop/PWA thinking app
- Current version: 0.1.8
- Desktop target: Windows x64
- Current state: local MVP plus encrypted local vault and signed updater flow

## Product Direction

Distill is designed as a personal thinking OS:

- capture thoughts instantly
- recover them later by meaning and context
- connect blocks through links, tags, people, projects, and dates
- preserve long-term ownership through local-first storage and portable exports
- keep trust/security central before adding sync

Influences:

- Obsidian: local ownership and links
- Logseq: daily notes and block workflows
- Mem: meaning-based rediscovery
- Reflect: calendar/people context and security posture
- PARA: action-oriented organization
- Zettelkasten: atomic notes and connection
- Local-first software: offline, ownership, portability

## What Is Built

Implemented app features:

- Inbox capture with `#tags`, `[[links]]`, and `@people` extraction
- Today view and daily-note grouping
- Search with exact matching plus local semantic-overlap hints
- Search evidence through matched fields and matched terms
- Projects and project assignment
- People index
- Knowledge graph inferred from unlocked store
- Archive/restore
- Inline edit
- Markdown export
- JSON export
- JSON restore
- Markdown bullet import
- Encrypted vault backup/restore
- Startup vault create/unlock screen
- Normal encrypted local persistence after unlock
- One-time migration from legacy plaintext local store
- Explicit clearing of known plaintext legacy data
- English/Japanese UI
- PWA/mobile preview path
- Signed Tauri updater check/install flow
- Manual update launcher fallback for newer Distill setup packages

## Current Persistence Boundary

Normal persistence is now encrypted at rest:

- Desktop key: `distill.vault.v1` in the Tauri SQLite `app_store` table
- Desktop encrypted backup: `backups/distill-encrypted-vault-latest.json`
- Browser/PWA key: `localStorage:distill.vault.v1`
- Encryption: PBKDF2 SHA-256 plus AES-256-GCM
- Search/graph: decrypted in memory after unlock

Legacy plaintext handling:

- `load_store_json` remains exposed only for one-time migration reads.
- `clear_plain_store` removes known plaintext normalized tables, legacy JSON key, and old plaintext backup.
- Plaintext save/search/graph Tauri commands are no longer exposed to the frontend capability.

Known remaining security limits:

- passphrase remains in app memory while unlocked
- whole-store encryption, not record-level encryption
- no passphrase change flow yet
- no lock-on-idle yet
- no sync yet
- browser preview still depends on localStorage for the encrypted envelope

## Technical Stack

- React
- TypeScript
- Vite
- Tauri 2
- Rust
- SQLite for encrypted envelope storage and legacy migration
- WebCrypto for vault encryption
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

Run desktop dev mode on Windows:

```powershell
npm run tauri:dev:windows
```

Run full verification:

```powershell
npm run check:all
```

Run dependency audit:

```powershell
npm run security:audit
```

Build signed Windows release artifacts:

```powershell
npm run release:windows
```

## Current Test Status

Latest full verification before 0.1.8 release packaging:

- `npm test`: 19 passed
- `npm run build`: passed
- `npm run test:rust`: 10 passed
- `npm run test:e2e`: 9 passed
- `npm run check:all`: passed

E2E coverage includes:

- vault creation/unlock
- Japanese default UI
- English MVP flow
- capture/search/graph/project/archive
- JSON restore
- Markdown import
- edit/archive/restore
- Markdown/JSON/backup downloads
- browser update boundary
- people index
- graph neighbors
- encrypted vault persistence after reload with no plaintext in localStorage

## Source Map

Key frontend files:

- `src/App.tsx`: app orchestration, vault lifecycle, autosave, imports/exports, updater flows
- `src/components/VaultGate.tsx`: vault setup/unlock UI
- `src/vaultCrypto.ts`: PBKDF2/AES-GCM vault encryption
- `src/storage.ts`: encrypted vault and legacy migration adapter
- `src/model.ts`: core types, extraction, local search
- `src/repository.ts`: immutable mutations
- `src/graph.ts`: graph modeling and neighbors
- `src/import.ts`: validated import logic
- `src/export.ts`: export/download logic
- `src/i18n.ts`: English/Japanese copy
- `src/components/`: UI panels

Key desktop files:

- `src-tauri/src/lib.rs`: Tauri commands, encrypted vault storage, legacy migration clear, updater launcher
- `src-tauri/capabilities/default.json`: Tauri command exposure boundary
- `src-tauri/tauri.conf.json`: app identity, CSP, updater config, packaging
- `src-tauri/build.rs`: generated command permission manifest

Key docs:

- `README.md`: quick project overview
- `docs/design_blueprint.md`: product and technical design
- `docs/project_context.md`: current context and handoff
- `docs/roadmap.md`: phase plan
- `docs/vault_encryption_design.md`: current vault boundary and next vault milestones
- `docs/sync_design.md`: encryption-first sync direction
- `docs/security_assessment_2026-05-06.md`: current security posture
- `docs/auto_update_runbook.md`: signed updater workflow

## Key Design Decisions

### Local-first before sync

Reason: personal thoughts are sensitive, offline speed matters, and long-term ownership is part of the product promise.

### Blocks as the core unit

Reason: thought fragments are smaller than pages and can connect to projects, people, tags, concepts, and dates.

### Whole-store encrypted vault for 0.1.x

Reason: fastest safe path from plaintext MVP to encrypted-at-rest local use.

Tradeoff: whole-store encryption is not ideal for sync/conflict resolution. Record-level encrypted records are the next architecture step.

### In-memory search and graph after unlock

Reason: persistent plaintext SQLite indexes would violate the encrypted-at-rest promise.

Tradeoff: search/graph indexes are rebuilt from memory and not yet optimized for very large vaults.

### Sync waits for encryption

Reason: syncing before the encryption model is stable risks leaking or locking private data into the wrong architecture.

## Recommended Next Steps

### Trust/Security

1. Add passphrase change flow.
2. Add lock-on-idle and lock-on-sleep.
3. Add restore preview before replacing a vault.
4. Add corrupted vault and tamper tests.
5. Move toward record-level encrypted records.

### Product Quality

1. Improve real Japanese copy quality.
2. Add daily/weekly review flows.
3. Add related-note recommendations.
4. Add restore preview and conflict summary.
5. Add user-selectable vault location.

### Distribution

1. Keep signed updater release process working for each version.
2. Acquire a Windows code-signing certificate for SmartScreen trust.
3. Add release checklist automation.
4. Create a clear download/install page.

## Handoff Summary

Distill is usable as a private local MVP with encrypted-at-rest local persistence. The next major architecture decision is record-level encrypted data plus sync design, not more plaintext SQLite indexing.
