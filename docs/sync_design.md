# Distill Sync Design

## Decision

Distill sync must be encryption-first. Sync should move encrypted vault records, not plaintext notes.

## Non-Goals For The First Sync Version

- No plaintext cloud database.
- No server-side semantic search over private notes.
- No server-held recovery key.
- No sync before local encryption is usable.

## Candidate Sync Modes

### Mode A: Encrypted File Sync

Use a single encrypted vault file or append-only encrypted record log stored in user-controlled cloud storage.

Examples:

- iCloud Drive
- OneDrive
- Google Drive
- Dropbox
- Syncthing

Pros:

- User owns the storage.
- No backend account required.
- Easier to reason about privacy.

Cons:

- Conflict handling is harder.
- Mobile browser access is limited by file APIs.

### Mode B: E2EE Hosted Sync

Distill runs a minimal backend that stores encrypted records and device metadata.

Pros:

- Better mobile/desktop sync UX.
- Can support device list and push/pull APIs.

Cons:

- Requires account, billing, abuse handling, server operations.
- Must be designed so the server cannot decrypt content.

### Mode C: Local Network Sync

Devices sync directly over LAN using encrypted records.

Pros:

- Strong ownership story.
- No cloud dependency.

Cons:

- Harder UX.
- Less reliable across networks.

## Recommended Path

1. Keep encrypted local vault as the default persistence boundary.
2. Move from whole-store vault encryption to record-level encrypted records.
3. Implement encrypted file sync first.
4. Add E2EE hosted sync only after the record format is stable.

## Current Implementation

Distill now has a pure TypeScript sync packet foundation in `src/sync.ts`.

Implemented:

- `distill.sync.packet` schema version `1`.
- block-level sync records for `ThoughtBlock`.
- checkpoint filtering with `since`.
- deterministic stable hashes for duplicate detection and tie-breaking.
- `distill.encrypted-sync.packet` schema version `1`.
- record-level AES-GCM encrypted sync records.
- wrong-passphrase rejection for encrypted sync packets.
- metadata tamper detection between encrypted wrappers and decrypted records.
- stable per-device identity stored locally as `distill.device.v1`.
- manual encrypted sync packet export/import UI.
- desktop sync-folder path for writing encrypted packet files, scanning packet candidates, safety-scanning candidates, auto-opening exactly one unambiguous safe candidate, and loading a selected packet into the existing preview flow.
- desktop sync-folder quarantine for suspicious or unwanted packet files.
- import preview before applying encrypted sync packets, with add/update/skip/delete counts.
- decision-review counts in sync previews for remote wins, local wins, same-time tie-breaks, and local changes/deletes.
- risk acknowledgement before applying packets that update/delete local data or rely on same-time tie-breaks.
- encrypted pre-sync recovery snapshots saved before applying any sync preview.
- in-app recovery snapshot listing, reading, and restore preview for saved pre-sync snapshots.
- known device registry persisted in the encrypted vault metadata.
- revoked device registry and rejection of future packets from locally revoked devices.
- deletion tombstones for permanent thought-block deletion.
- replay/rollback guard that skips packets whose `createdAt` is not newer than the known source device `lastPacketAt`.
- chained packet checkpoints using `previousPacketHash`, `packetHash`, and per-device `lastPacketHash`.
- deterministic merge rule:
  - accept a remote block when the local block is missing.
  - accept a remote block when `remote.updatedAt` is newer.
  - keep the local block when `local.updatedAt` is newer.
  - reject stale incoming blocks when a newer deletion tombstone exists.
  - apply incoming tombstones when they are newer than local block state.
  - use hash order only when timestamps are equal.
- parser validation for unsupported sync packet files.
- Tauri command validation for sync packet file names, packet schema, size limit, and top-level folder scanning.

Not implemented yet:

- project record sync.
- signed device keys beyond local hash-chain validation.
- automatic background network or cloud sync.

This keeps the risky part small: the app can prove merge behavior before any private data is sent to a network or cloud provider.

## Encrypted Sync Packet Shape

```json
{
  "type": "distill.encrypted-sync.packet",
  "schemaVersion": 1,
  "sourceDeviceId": "device-windows",
  "sourceDeviceName": "Windows desk",
  "createdAt": "2026-05-06T00:00:00.000Z",
  "previousPacketHash": "fnv1a32:previous",
  "packetHash": "fnv1a32:current",
  "revokedDevices": [
    {
      "id": "device-old-phone",
      "name": "Old phone",
      "revokedAt": "2026-05-06T01:00:00.000Z",
      "lastPacketHash": "fnv1a32:last-known"
    }
  ],
  "devices": [
    {
      "id": "device-windows",
      "name": "Windows desk",
      "firstSeenAt": "2026-05-06T00:00:00.000Z",
      "lastSeenAt": "2026-05-06T00:00:00.000Z",
      "lastPacketAt": "2026-05-06T00:00:00.000Z",
      "lastPacketHash": "fnv1a32:previous"
    }
  ],
  "records": [
    {
      "kind": "thought-block",
      "id": "b-123",
      "updatedAt": "2026-05-06T00:00:00.000Z",
      "hash": "fnv1a32:...",
      "encrypted": {
        "type": "distill.encrypted-sync-record",
        "value": "{...AES-GCM envelope...}"
      }
    },
    {
      "kind": "thought-block-deletion",
      "id": "b-124",
      "updatedAt": "2026-05-06T01:00:00.000Z",
      "hash": "fnv1a32:...",
      "encrypted": {
        "type": "distill.encrypted-sync-record",
        "value": "{...AES-GCM envelope containing the tombstone...}"
      }
    }
  ]
}
```

The outer wrapper contains only the fields required for sync routing, ordering, deterministic tie-breaking, and checkpoint validation. The decrypted record contains either the full `ThoughtBlock` payload or a deletion tombstone. During decryption, Distill verifies that the outer metadata matches the decrypted record before merging.

`packetHash` is computed from the plain sync packet with `packetHash` omitted. `previousPacketHash` must match the known source device `lastPacketHash` when Distill already knows that device. This gives manual sync a local hash-chain guard before automatic folder or hosted sync exists.

## Manual Sync Workflow

The current UI supports local manual sync only:

1. Unlock the vault.
2. Confirm or rename the local device name in Inspector.
3. Export an encrypted sync packet.
4. Move the `.distill-sync.json` file to another device manually.
5. Unlock the other device with the same vault passphrase.
6. Import the encrypted sync packet.
7. Distill decrypts records in memory and shows a sync preview before changing the vault.
8. The preview summarizes incoming records, devices, block additions, block updates, skipped blocks, block deletions, remote wins, local wins, same-time tie-breaks, and local changes/deletes.
9. Before applying the preview, Distill saves the current encrypted vault as a pre-sync recovery snapshot. If that save fails, sync is not applied.
10. The user can refresh the recovery snapshot list later, open a saved encrypted snapshot, decrypt it with a vault passphrase, and route it through the same Restore preview before replacing the current vault.
11. If the recovery snapshot succeeds, Distill verifies wrapper metadata, merges known devices, applies tombstones, and applies the deterministic merge.
12. Distill skips older or already imported packets from a known device to prevent rollback/replay imports.
13. Distill rejects newer packets from a known device if they do not continue that device's checkpoint chain.
14. Distill rejects packets from devices the user has revoked.
15. In desktop mode, the user can enter a sync-folder path, export encrypted packets into that folder, scan the folder, safety-classify candidates, and load a selected packet into the same preview/apply flow.
16. The user can run a safety scan that classifies folder packets as ready, risk review, stale, blocked, checkpoint risk, or invalid before previewing them.
17. The user can ask Distill to open a recommended preview only when exactly one safe packet is available and no risky/blocked/invalid packet is present.
18. The user can quarantine a selected sync-folder packet into `.distill-quarantine`; quarantined files no longer appear in normal sync scans.
19. If a preview would update/delete local data or rely on same-time tie-breaking, Distill requires an explicit risk acknowledgement before applying it.

This is intentionally not automatic yet. It gives us a safe test path for sync correctness before adding cloud folders, background jobs, or mobile sync.

## Sync Record Shape

```json
{
  "recordId": "block:b-123",
  "recordType": "block",
  "vaultId": "vault-...",
  "deviceId": "device-...",
  "schemaVersion": 1,
  "lamport": 42,
  "updatedAt": "2026-05-06T00:00:00.000Z",
  "deleted": false,
  "cipher": {
    "name": "AES-GCM",
    "iv": "base64"
  },
  "payload": "base64"
}
```

Plaintext metadata must be minimal. Content, tags, links, people, and project signals should be encrypted inside `payload`.

## Conflict Strategy

Use deterministic merges where possible:

- blocks: last-writer-wins per block for MVP
- project assignment: last-writer-wins
- archive/restore: last-writer-wins
- tags/links: recompute from decrypted content

Later:

- block-level CRDT for simultaneous text editing
- explicit conflict review screen
- signed packet checkpoints and richer device lifecycle management

## Device Identity

Each device gets:

- random `deviceId`
- user-visible device name
- created timestamp
- last sync timestamp

Do not use hardware identifiers.

The current registry is local and manual:

- the current device is registered when exporting a sync packet or renaming the device.
- imported packets merge `devices` metadata into the encrypted vault.
- the Inspector shows known devices.
- local device trust revocation exists; full device removal is still not implemented.
- `lastPacketAt` is used to reject stale imports from known devices.
- `lastPacketHash` is used to reject disconnected newer packets from known devices.

## Key Handling

The server or cloud storage must never receive:

- passphrase
- raw data encryption key
- plaintext notes
- plaintext embeddings

Allowed:

- encrypted data key wrapped by a user passphrase-derived key
- encrypted records
- minimal sync metadata

## Mobile Implication

PWA mode can participate only after IndexedDB + stronger encrypted local persistence is implemented. Native mobile can use stronger platform storage and local file APIs.

## First Implementable Sync Milestone

Encrypted file sync MVP:

1. Export encrypted `.distill-vault.json`.
2. Import encrypted `.distill-vault.json` on another device.
3. Add record-level encrypted append-only log. Current status: encrypted record packets exist and can be manually exported/imported.
4. Add a manual "merge encrypted vault" command. Current status: encrypted sync packet import previews and then merges block records, tombstones, device metadata, and checkpoint state.
5. Automate file read/write through a user-selected folder later. Current status: user-triggered folder write/scan exists, safety scan classifies packet candidates before import, recommended preview can open one unambiguous safe candidate without applying it, sync apply first saves an encrypted recovery snapshot, and saved recovery snapshots can be reopened through Restore preview.

## Security Gate

Before enabling automatic sync:

- wrong passphrase test
- corrupted payload test
- rollback/replay policy. Source-device `lastPacketAt` guard and local chained checkpoint validation are implemented; signed checkpoints remain future work.
- device removal story beyond local trust revocation
- backup recovery test. Current status: pre-sync encrypted recovery snapshots are saved before sync apply, and restore-from-recovery now has an in-app preview path.
- local cache clear test
