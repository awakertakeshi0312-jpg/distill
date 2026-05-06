# Storage Boundary

Distill currently uses a Tauri-backed SQLite store in desktop mode and browser `localStorage` as a development fallback. The application should treat `src/repository.ts` as the mutation boundary and `src/storage.ts` as the replaceable persistence boundary.

## Current Flow

1. `App.tsx` handles user intent.
2. `repository.ts` creates immutable store updates.
3. `storage.ts` persists the complete store through Tauri commands when available.
4. Desktop search uses a Tauri command backed by SQLite FTS5 plus local semantic-overlap retrieval. Browser search falls back to in-memory matching with the same semantic aliases.
5. `export.ts` converts the store into portable files.
6. `import.ts` validates portable JSON backups before replacing the active store.
7. `import.ts` converts Markdown bullet lists into appended Distill blocks.

## Current Adapter

The SQLite adapter now writes the `DistillStore` into normalized tables for projects, blocks, tags, links, people, concepts, graph edges, and an FTS5 search table. It still mirrors the full JSON document into `app_store` as a compatibility backup during the transition.

Tauri commands:

- `load_store_json`
- `save_store_json`
- `search_blocks_json`
- `load_graph_json`
- `load_storage_info_json`
- `start_update_installer`

SQLite file:

- App data directory: `distill.sqlite3`

Current normalized tables:

- `projects`
- `blocks`
- `block_tags`
- `block_links`
- `blocks_fts`
- `people`
- `block_people`
- `concepts`
- `graph_edges`
- `app_store` as fallback snapshot

Current block states:

- `open`: captured but not yet processed
- `linked`: assigned to context or carrying explicit links
- `processed`: triaged and kept in the active knowledge base
- `archived`: hidden from the active inbox but restorable from Archive

Current search result contract:

- `reason`: human-readable retrieval reason
- `matchedFields`: fields that contributed to the result, such as `content`, `tags`, or `links`
- `matchedTerms`: normalized query terms found in the block
- `semantic` matched field: local semantic-overlap terms that explain results when exact words differ

Current portability contract:

- JSON export includes `schemaVersion`, `exportedAt`, `blocks`, and `projects`.
- JSON restore validates project statuses, block states, required fields, tags, and links before saving.
- Restore is a full-store replacement and requires user confirmation in the UI.
- Inspector storage metadata shows the active SQLite path in desktop mode or the `localStorage` key in browser mode.
- Desktop mode writes an automatic latest backup to the app data `backups` directory after successful saves.
- Browser mode mirrors the latest backup into `localStorage:distill.backup.latest.v1`.
- Markdown import appends a new project and blocks; it does not replace the existing store.
- Manual update launch validates that the selected path points to a Distill setup `.exe`, starts it, then exits the app.

Current derived indexes:

- People are inferred from `@name`, `[[Person: Name]]`, and `[[People/Name]]`, then persisted into `people` and `block_people` in desktop mode.
- Concepts are inferred from wiki links and persisted into `concepts`.
- Graph edges are regenerated on save into `graph_edges` from block-project assignment, explicit wiki links, and inferred people mentions.
- The UI loads `load_graph_json` in Tauri mode and uses the SQLite graph snapshot when available. Browser mode still falls back to the in-memory inferred graph.
- Graph edge filtering is available for `all`, `project`, `person`, and `concept` relationships.
- Graph node neighbor inspection shows the selected node's connected project/person/concept/block neighbors in the UI.

## Next Adapter

The next step is to promote graph interactions beyond read-only snapshots: select edge types, query neighbors from SQLite, then move toward the fuller `entities`/`links` model in `docs/schema.sql` and replace local semantic-overlap aliases with true embedding retrieval beside FTS5.

The UI should not call SQLite directly. It should call repository commands or future service functions such as:

- `captureBlock(content)`
- `updateBlockState(blockId, state)`
- `assignBlockToProject(blockId, projectId)`
- `searchBlocks(query)`
- `exportVault(format)`

## Reason

This keeps the prototype useful now while protecting the app from a rewrite when the minimal normalized tables grow into the full schema with FTS5 and a vector index.
