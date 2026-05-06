# Distill Roadmap

## Current Phase

Distill 0.1.11 is past the local MVP gate. The main current phase is Trust Layer hardening: encrypted local vault is implemented, passphrase lifecycle is in place, restore preview is implemented, and record-level encrypted sync packets now have manual export/import, device registry, and deletion tombstones.

## Phase 1: Desktop MVP

Status: Complete.

- Inbox capture.
- Today view and daily-note grouping.
- Projects, Archive, inline edit, restore, and processed/open state.
- Tags, wiki links, people, and concepts.
- Local persistence.
- Local semantic-overlap retrieval.
- Knowledge graph with relationship filters and neighbors.
- Markdown and JSON export.
- English/Japanese UI.
- Windows NSIS installer.
- Manual update launcher.

## Phase 2: Practical Use Hardening

Status: Complete for local MVP.

Completed:

- First-run onboarding.
- Storage path visibility.
- Validated JSON restore.
- JSON restore confirmation before replacing the current store.
- Restore preview before replacing the current store.
- Manual JSON backup.
- Markdown import for bullet notes.
- Local semantic-overlap retrieval.
- Manual update launcher for newer setup packages.
- Installed-app QA on Windows.
- PWA/mobile preview path.
- E2E coverage for vault unlock, passphrase change, Japanese UI, MVP flow, restore/import, edit/archive/restore, exports, people/graph, and encrypted persistence.

Remaining polish:

- Conflict summary beyond full-store restore replacement.
- Empty-state and error-state polish.
- Better Japanese product copy.

## Phase 3: Trust Layer

Status: In progress.

Completed:

- Encrypted portable vault backup/restore.
- Startup vault create/unlock gate.
- Normal encrypted local persistence.
- Legacy plaintext migration.
- Known plaintext legacy data clearing.
- Removed plaintext save/search/graph commands from frontend capability exposure.

Next:

- Passphrase change flow. Complete.
- Lock-on-idle and lock-on-hidden. Complete.
- Restore preview before replacing vault. Complete.
- Corrupted/tampered vault tests.
- User-selectable vault location.
- Record-level encrypted records. Complete for manual sync packet export/import with deletion tombstones and device registry; automatic file sync is not enabled yet.
- Optional platform keyring or Tauri Stronghold convenience unlock.

## Phase 4: Retrieval Upgrade

Status: Partially complete.

- Add embedding generation.
- Add local vector index after unlock.
- Combine exact matching with vector retrieval.
- Explain why each result appears.
- Recommend related blocks and concepts from the selected block.

Constraint: embeddings/indexes must not be synced as plaintext.

## Phase 5: Knowledge Maturation

Status: Not started.

- Turn selected blocks into structure notes.
- Add daily and weekly review workflows.
- Add block clustering by topic.
- Add AI-assisted summarization, contradiction spotting, and next-action extraction.
- Add writing/export workflows for long-form output.

## Phase 6: Sync

Status: Foundation in code.

- Record-level encrypted packet records.
- Device identity.
- Known device registry.
- Deletion tombstones for permanent block deletion.
- Manual encrypted file sync first.
- Conflict handling.
- Optional E2EE hosted sync after record format is stable.

## Phase 7: Context Integrations

Status: Not started.

- Calendar integration.
- Meeting-note templates.
- Richer people pages.
- Project timelines.
- Source/document attachment model.

## Release Gate For 0.2.0

- Encrypted local vault is stable through multiple installed updates.
- Passphrase change and restore preview are implemented before 0.2.0.
- No known data-loss path in normal use.
- Search, edit, project assignment, archive, restore, import, export, people, graph, vault unlock, and encrypted persistence smoke tests are automated.
- Sync design has record-level encryption, device registry, deletion tombstones, and deterministic conflict strategy before automatic transport.
