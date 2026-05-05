# Distill MVP Requirements

## MVP Goal

Prove that Distill can capture thoughts quickly, store them locally, and help the user find and connect them later by keyword, meaning, date, project, and backlinks.

The MVP is successful if a user can use Distill daily for one week without needing another inbox or notes app for personal thinking.

## Must Have

### 1. Inbox

- One global capture input.
- Keyboard-first creation.
- Captured blocks are saved instantly.
- Captures default to today's daily note and the inbox state.
- Users can later assign project, tags, links, or status.

### 2. Daily Notes

- Automatic daily note per calendar date.
- Daily note shows captures, events, tasks, and edited blocks for that day.
- Users can create normal blocks inside the daily note.
- Daily notes can link to projects, people, and topics.

### 3. Block Editor

- Block-based editing with stable block IDs.
- Supported block types:
  - paragraph
  - heading
  - checklist
  - quote
  - source/reference
- Inline wiki links with `[[Title]]` syntax.
- Tags with `#tag` syntax.
- Basic markdown shortcuts.

### 4. Backlinks

- Each note and block can show inbound links.
- Backlinks include source title, block excerpt, date, and context.
- Unlinked mentions can be suggested but not auto-applied.

### 5. Search

- Keyword search over notes and blocks.
- Full-text ranking with highlighting.
- Semantic search over block content.
- Search results grouped by exact, semantic, recent, and linked context.
- Each result should explain why it appeared in a short reason string.

### 6. Project View

- Projects are first-class entities.
- A project page shows:
  - active notes
  - related blocks
  - linked people
  - open tasks
  - recent captures
- Initial PARA support should focus on Projects only.

### 7. Export

- Export all notes as Markdown.
- Export full graph as JSON.
- Export must preserve block IDs, links, tags, dates, and entity references.

## Should Have

- Command palette.
- Local settings file.
- Import from Markdown folder.
- Basic graph neighborhood view for one note or project.
- AI-assisted title suggestions for untitled captures.
- AI-assisted clustering for inbox cleanup.

## Not In MVP

- Real-time collaboration.
- Cross-device sync.
- Plugin system.
- Public publishing.
- Complex graph visualization.
- Calendar provider sync.
- End-to-end encrypted cloud sync.

## MVP Acceptance Criteria

- The app launches without internet.
- A user can capture a thought in under three seconds after app focus.
- A user can search by an approximate concept and retrieve relevant old blocks.
- A user can inspect backlinks for any note or project.
- All user-created data can be exported into readable local files.
- Deleting the app does not strand user data in a proprietary remote service.

