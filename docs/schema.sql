PRAGMA foreign_keys = ON;

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('daily', 'project', 'topic', 'person', 'source', 'standard')),
  note_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  parent_block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'paragraph',
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'linked', 'processed')),
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'person', 'topic', 'event', 'source', 'tag')),
  name TEXT NOT NULL,
  canonical_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, name)
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'block', 'entity')),
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('note', 'block', 'entity')),
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'mentions',
  created_at TEXT NOT NULL
);

CREATE INDEX links_source_idx ON links(source_type, source_id);
CREATE INDEX links_target_idx ON links(target_type, target_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- Transitional graph tables currently implemented by the Tauri SQLite adapter.
-- These can later be folded into entities + links when the data model is promoted.
CREATE TABLE people (
  name TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE block_people (
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  person TEXT NOT NULL REFERENCES people(name) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (block_id, person)
);

CREATE TABLE concepts (
  name TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE graph_edges (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id, edge_type)
);

CREATE TABLE block_tags (
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (block_id, tag_id)
);

CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector BLOB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(block_id, provider, model)
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  source_type TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  external_provider TEXT,
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE blocks_fts USING fts5(
  block_id UNINDEXED,
  content,
  tags,
  links,
  tokenize = 'porter unicode61'
);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  body,
  tokenize = 'porter unicode61'
);

