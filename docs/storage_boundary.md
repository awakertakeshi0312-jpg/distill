# Storage Boundary

Distill treats `src/repository.ts` as the mutation boundary and `src/storage.ts` as the replaceable persistence boundary.

## Current Flow

1. `App.tsx` starts in vault setup/unlock mode.
2. `storage.ts` loads `distill.vault.v1` or reads a legacy plaintext store for one-time migration.
3. `vaultCrypto.ts` decrypts the vault with the user passphrase.
4. `App.tsx` keeps the decrypted `DistillStore` in memory while unlocked.
5. `repository.ts` creates immutable store updates.
6. `App.tsx` encrypts and saves the complete store after changes.
7. Search and graph run against the unlocked in-memory store.
8. `export.ts` and `import.ts` handle portable JSON, Markdown, and encrypted vault files.

## Current Adapter

Desktop mode stores an encrypted vault envelope in SQLite `app_store` under key `distill.vault.v1`.

Browser/PWA preview stores the encrypted vault envelope in `indexedDB:distill-browser-vault/vaults/distill.vault.v1`.

Tauri commands exposed to the frontend capability:

- `load_store_json`: legacy plaintext migration read only
- `load_vault_json`: read encrypted vault envelope
- `save_vault_json`: write encrypted vault envelope
- `clear_plain_store`: clear known legacy plaintext storage
- `load_storage_info_json`: show storage and backup paths
- `start_update_installer`: validated manual update launcher

Commands no longer exposed:

- plaintext store save
- plaintext SQLite search
- plaintext SQLite graph loading

Desktop files:

- SQLite file: `distill.sqlite3`
- encrypted latest backup: `backups/distill-encrypted-vault-latest.json`
- old plaintext backup cleared on migration: `backups/distill-auto-backup-latest.json`

## Vault Contract

Persistent vault envelope:

- type: `distill.encrypted-vault`
- schema version: 1
- KDF: PBKDF2 SHA-256
- cipher: AES-256-GCM
- payload: encrypted Distill JSON export

Decrypted store contract:

- `blocks`
- `projects`
- block states: `open`, `linked`, `processed`, `archived`
- tags and links are recomputed by repository updates
- people and graph data are derived after unlock

## Portability Contract

- JSON export includes `schemaVersion`, `exportedAt`, `blocks`, and `projects`.
- JSON restore validates project statuses, block states, required fields, tags, and links before saving.
- Encrypted vault backup exports the same store through the vault envelope.
- Restore is a full-store replacement and requires user confirmation in the UI.
- Markdown import appends a new project and blocks; it does not replace the existing store.

## Search And Graph Boundary

Current search result contract:

- `reason`: human-readable retrieval reason
- `matchedFields`: fields that contributed to the result, such as `content`, `tags`, `links`, or `semantic`
- `matchedTerms`: normalized query terms found in the block

Current derived graph:

- People are inferred from `@name`, `[[Person: Name]]`, and `[[People/Name]]`.
- Concepts are inferred from wiki links.
- Graph edges are derived from block-project assignment, explicit wiki links, and inferred people mentions.
- Graph filtering supports `all`, `project`, `person`, and `concept` relationships.

Persistent plaintext indexes are intentionally avoided after vault unlock.

## Next Adapter

The next storage boundary should move from whole-store vault encryption to record-level encrypted records:

- encrypted block records
- encrypted project records
- append-only encrypted mutation log
- minimal plaintext sync metadata
- rebuildable local search/vector indexes after unlock

Future service functions should keep the UI away from storage details:

- `captureBlock(content)`
- `updateBlockState(blockId, state)`
- `assignBlockToProject(blockId, projectId)`
- `searchBlocks(query)`
- `exportVault(format)`
- `changeVaultPassphrase()`
- `mergeEncryptedVault()`

## Reason

This boundary keeps local private use safe now while making the next architecture step clear: encrypted records and sync-safe conflict handling without reintroducing plaintext persistent indexes.
