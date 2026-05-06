# Distill Project Context

## Purpose

This document is the handoff context for Distill so another person or future agent can understand the current state, run the project, and continue safely.

## Project Identity

- Project name: Distill
- Location: `C:\Users\awake\dev\active\distill`
- Repository: `https://github.com/awakertakeshi0312-jpg/distill`
- Product type: local-first desktop/PWA thinking app
- Current version: 0.1.26
- Desktop target: Windows x64
- Current state: local MVP plus encrypted local vault, signed updater flow, restore preview, manual encrypted sync packet flow with apply preview, decision-review counts, risk acknowledgement gate, encrypted pre-sync recovery snapshots with in-app preview/restore, desktop sync-folder packet exchange prototype with safety scan, monitor-only review queue, outbound auto-export for local changes, recommended preview, and packet quarantine, device registry, signed device checkpoints, unknown-device trust confirmation, device trust revocation, deletion tombstones, stale-packet rejection, chained checkpoint validation, and Personal KM summary-only handoff

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
- Restore preview with added/updated/removed/unchanged counts before JSON or encrypted vault replacement
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
- Stable local device identity for sync packet source tracking
- Manual encrypted sync packet export/import using record-level encrypted records
- Desktop sync-folder path for writing, scanning, safety-classifying, recommended preview, and manual previewing encrypted sync packet files
- Monitor-only sync-folder review queue that refreshes safety scan results without auto-previewing or auto-applying
- Outbound sync-folder auto-export that writes encrypted packets only when local sync content changes
- Sync packet apply preview with add/update/skip/delete counts before merging
- Sync packet decision review with remote wins, local wins, same-time tie-breaks, and local changes/deletes
- Sync risk acknowledgement gate before applying packets that update/delete local data or rely on same-time tie-breaks
- Encrypted pre-sync recovery snapshot before any sync preview is applied
- In-app listing and restore preview for encrypted pre-sync recovery snapshots
- Sync-folder packet quarantine into `.distill-quarantine`
- Manual sync device registry in the Inspector
- Signed device checkpoints on outbound sync packets
- Trusted-device signature verification before sync apply
- Unknown-device trust confirmation before sync apply
- Sync device trust revocation and revoked-device packet rejection
- Permanent archive deletion with sync tombstones
- Stale sync packet rejection based on known device `lastPacketAt`
- Chained sync checkpoint validation based on known device `lastPacketHash`
- Personal KM summary-only handoff for processed blocks and AI Org artifacts
- React render error boundary that shows recovery guidance instead of a blank screen

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
- normal vault persistence is whole-store encrypted; sync packets use record-level encrypted records
- restore preview exists, but restore still replaces the full local store after user approval
- no automatic inbound apply or cloud sync yet; current sync-folder flow supports outbound auto-export plus local safety classification, monitor-only review refresh, recommended preview, signed trusted-device verification, unknown-device trust confirmation, recovery snapshot gating before apply, and manual recovery preview after apply
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

Latest verification after signed device checkpoint update:

- `npm test`: 50 passed
- `npm run build`: passed
- `npm run test:rust`: 18 passed
- `npm run test:e2e`: 10 passed
- `npm run security:audit`: 0 vulnerabilities
- `npm run release:windows`: signed Windows installer generated
- `npm run release:check`: passed

E2E coverage includes:

- vault creation/unlock
- passphrase change and old-passphrase rejection
- Japanese default UI
- English MVP flow
- capture/search/graph/project/archive
- JSON restore
- restore preview before JSON replacement
- Markdown import
- edit/archive/restore
- Markdown/JSON/backup downloads
- browser update boundary
- people index
- graph neighbors
- encrypted vault persistence after reload with no plaintext in localStorage
- encrypted sync packet export download
- permanent archive deletion with confirmation
- sync packet apply preview, stale packet rejection, and checkpoint chain rejection are covered by unit tests
- encrypted vault tamper/corruption rejection is covered by unit tests

## Source Map

Key frontend files:

- `src/App.tsx`: app orchestration, vault lifecycle, autosave, imports/exports, updater flows
- `src/components/VaultGate.tsx`: vault setup/unlock UI
- `src/vaultCrypto.ts`: PBKDF2/AES-GCM vault encryption
- `src/sync.ts`: sync packet build/parse/merge, tombstones, device registry, and record-level encrypted sync packets
- `src/syncPreview.ts`: sync packet diff calculation before applying encrypted sync imports
- `src/device.ts`: stable local device identity
- `src/storage.ts`: encrypted vault, legacy migration, updater, desktop sync-folder adapter, and sync recovery snapshot list/read adapter
- `src/model.ts`: core types, extraction, local search
- `src/repository.ts`: immutable mutations
- `src/graph.ts`: graph modeling and neighbors
- `src/import.ts`: validated import logic
- `src/restorePreview.ts`: restore diff calculation before replacing the current store
- `src/personalKmHandoff.ts`: summary-only Personal KM review handoff builder/sender
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
- `docs/distill_system_design.md`: latest Japanese system design for product, architecture, trust layer, sync, mobile, and roadmap
- `docs/design_blueprint.md`: product and technical design
- `docs/project_context.md`: current context and handoff
- `docs/roadmap.md`: phase plan
- `docs/vault_encryption_design.md`: current vault boundary and next vault milestones
- `docs/sync_design.md`: encryption-first sync direction
- `docs/security_assessment_2026-05-06.md`: current security posture
- `docs/auto_update_runbook.md`: signed updater workflow
- `docs/distill_personal_km_handoff.md`: summary-only handoff contract/generated table

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

Current status: manual encrypted sync packets, signed device checkpoints, apply preview, sync-folder safety scan, monitor-only review queue, outbound auto-export, recommended preview, unknown-device trust confirmation, encrypted pre-sync recovery snapshots with in-app restore preview, device registry, deletion tombstones, device trust revocation, and chained checkpoint validation exist. Automatic inbound apply and cloud/background sync are still blocked until background transport, mobile storage, and stronger signed-device assurance are specified.

## Recommended Next Steps

### Trust/Security

1. Add device removal UI beyond trust revocation.
2. Add guarded inbound folder sync prototype after signed-device assurance.
3. Add cross-device public-key verification UX, such as QR/fingerprint comparison.
4. Add user-selectable vault location.
5. Add OS-native idle/sleep integration.

### Product Quality

1. Improve real Japanese copy quality.
2. Add daily/weekly review flows.
3. Add related-note recommendations.
4. Add richer conflict summary beyond full-store restore preview. Sync packet previews are implemented.
5. Add user-selectable vault location.

### Distribution

1. Keep signed updater release process working for each version.
2. Acquire a Windows code-signing certificate for SmartScreen trust.
3. Keep `npm run release:check` passing before public distribution.
4. Create a clear download/install page.

## Handoff Summary

Distill is usable as a private local MVP with encrypted-at-rest local persistence, manual encrypted sync packets, signed device checkpoints, sync-folder safety scans, monitor-only review queues, outbound auto-export, recommended previews, unknown-device trust confirmation, apply previews, encrypted pre-sync recovery snapshots with restore preview, device registry, deletion tombstones, device trust revocation, and chained checkpoint validation. The next major architecture decision is automatic sync transport and signed-device assurance, not more plaintext SQLite indexing.
