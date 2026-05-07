# Distill Roadmap

## Current Phase

Distill 0.1.40 is past the local MVP gate. The main current phase is Trust Layer and Sync hardening: encrypted local vault is implemented, passphrase lifecycle is in place, restore preview is implemented, and record-level encrypted sync packets now have manual export/import, desktop sync-folder packet exchange, sync-folder safety scan, monitor-only review queue, outbound auto-export for local changes, recommended preview, packet quarantine, risk acknowledgement before destructive applies, encrypted pre-sync recovery snapshots with in-app restore preview, device registry, signed device checkpoints, source-device verification codes with QR display/scanner import, known-device forget/removal, safe semi-automatic inbound preview, mobile/PWA install guidance, update-safer offline shell caching, phone-width PWA smoke coverage, IndexedDB-backed encrypted browser vault persistence, volatile in-memory vault session passphrase handling, non-exportable WebCrypto vault session key persistence, packet-level non-exportable WebCrypto sync session key support, dedicated encrypted-vault sync key material with visible create/rotate lifecycle controls, single-vault and A/B multi-device recovery drills, and wrapped bootstrap support, unknown-device trust confirmation, device trust revocation, deletion tombstones, replay/rollback protection, chained checkpoint validation, and apply-before-confirm sync previews with decision-review counts.

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
- PWA/mobile preview path with install metadata, home-screen guidance, update-safer service worker caching, phone-width E2E smoke coverage, and IndexedDB-backed encrypted browser vault storage.
- E2E coverage for vault unlock, passphrase change, Japanese UI, MVP flow, restore/import, edit/archive/restore, exports, people/graph, and encrypted persistence.

Remaining polish:

- Conflict summary beyond full-store restore replacement. Sync packet previews now show decision-review counts; richer full-vault conflict review remains.
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
- Corrupted/tampered vault tests. Complete for unsupported envelope and tampered payload coverage.
- User-selectable vault location.
- Record-level encrypted records. Complete for manual sync packet export/import with apply preview, deletion tombstones, device registry, device trust revocation, known-device forget/removal, stale packet rejection, chained checkpoint validation, sync decision-review counts, risk acknowledgement, encrypted pre-sync recovery snapshots with restore preview, sync-folder safety scan, monitor-only review queue, outbound auto-export for local changes, recommended preview, packet quarantine, and explicit desktop sync-folder packet exchange; automatic inbound apply/cloud sync is not enabled yet.
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
- Packet-level sync KDF metadata so records in one new encrypted packet share one non-exportable WebCrypto sync session key while legacy packets remain decryptable.
- Dedicated sync key material stored inside the encrypted vault, with Inspector create/rotate lifecycle controls, single-vault and A/B multi-device recovery drills, and passphrase-wrapped bootstrap metadata in new packets for recovery/first import.
- Device identity.
- Known device registry.
- Deletion tombstones for permanent block deletion.
- Replay/rollback guard using known device `lastPacketAt`.
- Chained checkpoint validation using known device `lastPacketHash`.
- Apply-before-confirm preview for encrypted sync packets.
- Signed device checkpoints using per-device ECDSA P-256 keys.
- Trusted-device signature verification before applying sync packets.
- Source-device verification code entry before trusting first-seen signed source-device packets.
- Local device verification payload QR display in the sync panel.
- Receiving-device QR scanner and paste import for source-device verification payloads.
- Device trust revocation, known-device forget/removal, and revoked-device rejection.
- Desktop sync-folder packet writing, scanning, selected-packet preview, safety classification, and assisted recommended preview.
- Monitor-only sync-folder review queue refresh, plus safe semi-automatic preview opening for one unambiguous known-device ready packet. Apply is never automatic.
- Outbound sync-folder auto-export for local content changes, with duplicate-loop prevention.
- Sync preview decision review for remote wins, local wins, same-time tie-breaks, and local changes/deletes.
- Risk acknowledgement before applying destructive or same-time tie-break sync packets.
- Encrypted pre-sync recovery snapshot before applying any sync preview.
- In-app recovery snapshot listing and restore preview.
- Sync-folder packet quarantine into `.distill-quarantine`.
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
- Sync design has record-level encryption, device registry, deletion tombstones, replay/rollback guard, chained checkpoint validation, sync-folder safety classification, monitor-only review queue, outbound auto-export, assisted recommended preview, signed device checkpoints, source-device verification codes with QR display/scanner import, known-device forget/removal, unknown-device trust confirmation, encrypted pre-sync recovery snapshots with restore preview, packet-level sync session KDF metadata, dedicated sync-key bootstrap, lifecycle controls, single-vault and A/B recovery drills, and deterministic conflict strategy before automatic transport.
