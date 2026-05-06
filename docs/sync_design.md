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
- deterministic merge rule:
  - accept a remote block when the local block is missing.
  - accept a remote block when `remote.updatedAt` is newer.
  - keep the local block when `local.updatedAt` is newer.
  - use hash order only when timestamps are equal.
- parser validation for unsupported sync packet files.

Not implemented yet:

- record-level encryption.
- project record sync.
- deletion tombstones.
- device registry UI.
- automatic network or cloud sync.

This keeps the risky part small: the app can prove merge behavior before any private data is sent to a network or cloud provider.

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

## Device Identity

Each device gets:

- random `deviceId`
- user-visible device name
- created timestamp
- last sync timestamp

Do not use hardware identifiers.

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
3. Add record-level encrypted append-only log.
4. Add a manual "merge encrypted vault" command.
5. Automate file read/write through a user-selected folder later.

## Security Gate

Before enabling automatic sync:

- wrong passphrase test
- corrupted payload test
- rollback/replay policy
- device removal story
- backup recovery test
- local cache clear test
