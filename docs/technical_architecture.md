# Distill Technical Architecture

## Architecture Summary

Distill should start as a local desktop app with a durable local data store and optional AI services. The first implementation should optimize for local reliability, fast search, clear exports, and a small surface area.

Recommended stack:

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Local database: SQLite
- Full-text search: SQLite FTS5
- Semantic index: sqlite-vec or LanceDB
- Styling: CSS modules or a small design system layer
- App state: Zustand or TanStack Query
- Export: Markdown + JSON

## Data Storage

SQLite is the source of truth for the app.

Initial tables:

- `notes`
- `blocks`
- `links`
- `entities`
- `tags`
- `block_tags`
- `embeddings`
- `sources`
- `events`
- `settings`

FTS tables:

- `blocks_fts`
- `notes_fts`

The system should treat Markdown export as a portability feature, not the primary write model. This keeps block IDs, graph links, embeddings, and metadata reliable while still preserving user ownership.

## Search Pipeline

Search should run in layers:

1. Exact title and entity match.
2. SQLite FTS block and note search.
3. Semantic vector search.
4. Graph expansion for linked context.
5. Ranking merge with reason strings.

Result reason examples:

- Exact title match.
- Similar meaning to query.
- Linked from matching project.
- Mentioned in recent daily note.
- Shares topic with matched block.

## AI Boundary

AI should be optional and task-specific.

MVP AI jobs:

- Generate embeddings.
- Suggest title for untitled captures.
- Suggest project/topic during inbox processing.
- Summarize a group of related blocks.

Avoid:

- Sending all notes to a remote model by default.
- Making chat the primary interface.
- Applying links or restructuring data without user confirmation.

## Sync Strategy

Do not implement sync in the MVP.

Prepare for future sync by:

- Using stable UUIDs.
- Recording `created_at` and `updated_at`.
- Avoiding hidden remote-only state.
- Keeping migrations deterministic.
- Designing conflict handling around block-level changes.

Future sync options:

- Local folder sync with user-owned files.
- Encrypted app sync service.
- CRDT-based sync for advanced collaboration.

## Security And Privacy

MVP:

- Local-only data by default.
- No telemetry unless explicitly enabled.
- No remote AI unless explicitly configured.
- Export path controlled by user.

Future:

- At-rest encryption.
- End-to-end encrypted sync.
- Per-provider AI controls.
- Redaction before remote AI calls.

## Implementation Milestones

### Milestone 1: Local Core

- Tauri app shell.
- SQLite setup and migrations.
- Notes and blocks CRUD.
- Inbox and Today views.

### Milestone 2: Retrieval

- FTS5 search.
- Backlinks.
- Tags and wiki links.
- Search result grouping.

### Milestone 3: Semantic Layer

- Embedding job queue.
- Vector index.
- Semantic search.
- Similar block recommendations.

### Milestone 4: Knowledge Workflow

- Project view.
- Inbox processing.
- AI title/project suggestions.
- Markdown and JSON export.

