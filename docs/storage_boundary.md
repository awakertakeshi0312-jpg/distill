# Storage Boundary

Distill currently uses browser `localStorage` only as a prototype persistence adapter. The application should treat `src/repository.ts` as the mutation boundary and `src/storage.ts` as the replaceable persistence boundary.

## Current Flow

1. `App.tsx` handles user intent.
2. `repository.ts` creates immutable store updates.
3. `storage.ts` persists the complete store.
4. `export.ts` converts the store into portable files.

## Next Adapter

When Tauri is available, replace `storage.ts` with a SQLite-backed adapter that follows `docs/schema.sql`.

The UI should not call SQLite directly. It should call repository commands or future service functions such as:

- `captureBlock(content)`
- `updateBlockState(blockId, state)`
- `assignBlockToProject(blockId, projectId)`
- `searchBlocks(query)`
- `exportVault(format)`

## Reason

This keeps the prototype useful now while protecting the app from a rewrite when localStorage becomes SQLite, FTS5, and a vector index.

