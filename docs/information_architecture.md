# Distill Information Architecture

## Core Mental Model

Distill has four levels:

1. Block: the atomic thought.
2. Note: an editable surface that groups blocks.
3. Entity: a durable object such as project, person, topic, source, or event.
4. Graph: relationships between blocks, notes, and entities.

The UI should let users write in familiar note surfaces while the system quietly builds a structured graph underneath.

## Primary Objects

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

Fields:

- `id`
- `title`
- `kind`
- `created_at`
- `updated_at`
- `date`

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

Fields:

- `id`
- `source_type`
- `source_id`
- `target_type`
- `target_id`
- `relationship`
- `created_at`

Common relationships:

- `mentions`
- `supports`
- `contradicts`
- `belongs_to`
- `derived_from`
- `next_action_for`
- `met_with`

## Navigation

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

## Views

### Inbox View

Purpose: process loose captures.

Default sections:

- Unprocessed captures
- Suggested project/topic
- Similar existing blocks
- Quick actions

### Today View

Purpose: daily operating surface.

Sections:

- Capture input
- Today's blocks
- Open tasks
- Recently touched projects
- Meetings/events placeholder

### Project View

Purpose: connect thinking to active outcomes.

Sections:

- Project brief
- Recent blocks
- Open tasks
- Linked notes
- Related people
- Related sources

### Search View

Purpose: rediscover by meaning and relationship.

Sections:

- Exact matches
- Semantic matches
- Linked context
- Recent related activity

## Linking Syntax

Initial syntax:

- `[[Note or Entity]]`
- `#tag`
- `@person`
- `!source`

Block-level links should use stable block IDs internally, even if the UI displays friendly titles and excerpts.

