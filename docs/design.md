# Distill Design Document

## 1. Product Definition

Distill is a local-first personal thinking environment. It captures loose thoughts quickly, preserves the user's long-term ownership of their knowledge, and helps them rediscover, connect, and mature ideas through search, links, context, and lightweight structure.

Distill should not compete as a generic notes app. Its strongest position is:

> A personal intelligence OS that turns captured fragments into usable knowledge while keeping the user's data portable, private, and durable.

## 2. Design Principles

1. Capture before organization.
   Users should be able to write immediately without choosing folders, tags, projects, or templates.

2. Blocks are the atomic unit.
   Notes are useful editing surfaces, but individual blocks represent reusable thoughts, claims, questions, tasks, references, and observations.

3. Meaning beats exact recall.
   Search must support keyword recall, fuzzy recall, semantic recall, and relationship-based resurfacing.

4. Context is part of the thought.
   Dates, meetings, people, projects, sources, and tasks should be first-class context rather than metadata hidden in settings.

5. Ownership is non-negotiable.
   The app should work locally, export cleanly, and avoid lock-in. Cloud and AI features should be additive, explicit, and reversible.

## 3. MVP Goal

Prove that Distill can capture thoughts quickly, store them locally, and help the user find and connect them later by keyword, meaning, date, project, and backlinks.

The MVP is successful if a user can use Distill daily for one week without needing another inbox or notes app for personal thinking.

## 4. MVP Scope

### Must Have

- Inbox with instant keyboard-first capture.
- Daily notes generated per calendar date.
- Block editor with stable block IDs.
- Inline wiki links with `[[Title]]` syntax.
- Tags with `#tag` syntax.
- Backlinks for notes and blocks.
- Keyword search and semantic search.
- Search result reason strings.
- First-class project view.
- Markdown and JSON export.

### Should Have

- Command palette.
- Local settings file.
- Markdown folder import.
- Local graph neighborhood view.
- AI-assisted title suggestions.
- AI-assisted inbox clustering.

### Not In MVP

- Real-time collaboration.
- Cross-device sync.
- Plugin system.
- Public publishing.
- Complex graph visualization.
- Calendar provider sync.
- End-to-end encrypted cloud sync.

## 5. Information Architecture

Distill has four levels:

1. Block: the atomic thought.
2. Note: an editable surface that groups blocks.
3. Entity: a durable object such as project, person, topic, source, or event.
4. Graph: relationships between blocks, notes, and entities.

The UI should let users write in familiar note surfaces while the system quietly builds a structured graph underneath.

## 6. Primary Objects

### Block

A block is the smallest addressable knowledge unit.

Fields:

- `id`
- `note_id`
- `parent_block_id`
- `type`
- `content`
- `position`
- `created_at`
- `updated_at`
- `captured_at`
- `status`

### Note

A note is an editable document-like container.

Kinds:

- `daily`
- `project`
- `topic`
- `person`
- `source`
- `standard`

### Entity

An entity represents something that can recur across notes.

Types:

- `project`
- `person`
- `topic`
- `event`
- `source`
- `tag`

### Link

A link connects graph nodes.

Common relationships:

- `mentions`
- `supports`
- `contradicts`
- `belongs_to`
- `derived_from`
- `next_action_for`
- `met_with`

## 7. Primary Navigation

The primary app shell should include:

- Inbox
- Today
- Search
- Projects
- Graph
- Archive

The main workspace should support:

- Editor pane
- Backlinks side pane
- Search/result pane
- Context inspector

## 8. Recommended Technical Stack

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Local database: SQLite
- Full-text search: SQLite FTS5
- Semantic index: sqlite-vec or LanceDB
- Styling: CSS modules or a small design system layer
- App state: Zustand or TanStack Query
- Export: Markdown + JSON

## 9. Data Storage

SQLite is the intended source of truth for the app.

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

Markdown export is a portability feature, not the primary write model. This keeps block IDs, graph links, embeddings, and metadata reliable while preserving user ownership.

## 10. Search Pipeline

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

## 11. AI Boundary

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

## 12. Security And Privacy

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

## 13. Implementation Milestones

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

## 14. Current Prototype Boundary

The current prototype uses browser `localStorage` as a temporary persistence adapter.

Current flow:

1. `App.tsx` handles user intent.
2. `repository.ts` creates immutable store updates.
3. `storage.ts` persists the complete store.
4. `export.ts` converts the store into portable files.

When Tauri is available, replace `storage.ts` with a SQLite-backed adapter that follows `docs/schema.sql`.

