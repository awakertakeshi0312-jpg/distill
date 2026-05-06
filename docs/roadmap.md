# Distill Roadmap

## Current Phase

Phase 2 is functionally complete for the local MVP. The 0.1.0 desktop MVP is complete, buildable, installed-app verified, and includes the first practical-use hardening layer: onboarding, storage path visibility, validated restore, import/export, and local backups.

## Phase 1: Desktop MVP

Status: Complete.

- Inbox capture.
- Today view and daily-note grouping.
- Projects, Archive, inline edit, restore, and processed/open state.
- Tags, wiki links, people, and concepts.
- SQLite persistence in Tauri mode.
- SQLite FTS5 search with evidence.
- Local semantic-overlap retrieval.
- Knowledge graph with relationship filters and neighbors.
- Markdown and JSON export.
- English/Japanese UI.
- Windows NSIS installer.
- Manual update launcher.

## Phase 2: Practical Use Hardening

Status: Functionally complete for local MVP.

Completed:

- First-run onboarding.
- Storage path visibility.
- Validated JSON restore.
- JSON restore confirmation before replacing the current store.
- Manual JSON backup.
- Automatic latest local backup.
- Markdown import for bullet notes.
- Local semantic-overlap retrieval.
- Manual update launcher for newer setup packages.
- Installed-app QA on Windows.
- E2E coverage for Japanese UI, MVP flow, JSON restore, Markdown import, edit/archive/restore, exports, people/graph, and project persistence.

Remaining:

- Safer restore flow with conflict summary.
- Empty-state and error-state polish.
- Additional polish beyond the local MVP release gate.

## Phase 3: Retrieval Upgrade

Status: Partially complete.

- Add embedding generation.
- Add vector index storage.
- Combine SQLite FTS5 with vector retrieval.
- Explain why each result appears.
- Recommend related blocks and concepts from the selected block.

## Phase 4: Knowledge Maturation

Status: Not started.

- Turn selected blocks into structure notes.
- Add daily and weekly review workflows.
- Add block clustering by topic.
- Add AI-assisted summarization, contradiction spotting, and next-action extraction.
- Add writing/export workflows for long-form output.

## Phase 5: Trust Layer

Status: Not started.

- User-selectable vault location.
- Automatic local backups. Complete.
- Database migration strategy.
- Optional encryption.
- Signed installer.
- Signed auto-update channel. Implemented locally; release hosting remains.

## Phase 6: Context Integrations

Status: Not started.

- Calendar integration.
- Meeting-note templates.
- Richer people pages.
- Project timelines.
- Source/document attachment model.

## Release Gate For 0.2.0

- Installed app passes the manual QA checklist.
- Backup and restore are safe enough for real notes.
- No known data-loss path in normal use.
- Search, edit, project assignment, archive, restore, import, export, people, and graph smoke tests are automated.
