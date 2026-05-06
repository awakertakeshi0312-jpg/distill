# Distill 0.1.0 Release Notes

## Summary

Distill 0.1.0 is the first complete local-first desktop MVP. It provides a working personal thinking environment with capture, triage, search, graph context, projects, archive, exports, and SQLite-backed desktop persistence.

## Highlights

- Local-first Tauri desktop shell with SQLite persistence.
- Browser fallback through `localStorage` and in-memory search.
- Inbox capture with lightweight structure extraction.
- Daily-note oriented Today view.
- SQLite FTS5 search with matched field/term evidence.
- Local semantic-overlap retrieval when exact words differ.
- People and concept extraction.
- SQLite-derived graph snapshots.
- Graph relationship filtering and neighbor inspection.
- English/Japanese UI switching.
- Markdown and JSON export.
- Validated JSON restore for portable backups.
- Markdown import for bullet-based notes.
- Manual JSON backup and automatic latest local backup.
- First-run onboarding.
- Signed auto-update check/install flow.
- Manual update launcher fallback for newer setup packages.
- Storage path visibility.
- Windows NSIS installer build.

## Verification

The release candidate passes:

- Frontend/domain tests: 17 passed.
- Rust/SQLite tests: 8 passed.
- Production frontend build.
- Windows Tauri bundle build.
- Browser E2E smoke tests: Japanese default UI, English MVP flow, JSON restore, Markdown import, edit/archive/restore, exports, people/graph, and project persistence.

## Artifact

```text
src-tauri/target/release/bundle/nsis/Distill_0.1.0_x64-setup.exe
```

SHA256:

```text
57339EC6F50B631EACC8933CA64CA2CC1A1466C80AC643DCB7448F5671A5628F
```

## Known Limits

- Unsigned installer.
- Signed updater is implemented locally; public update delivery requires uploading `latest.json`, installer, and signature to the configured host.
- No cloud sync.
- Local semantic-overlap retrieval is implemented, but no embedding/vector index yet.
- Browser E2E coverage is still a smoke suite, not full regression coverage.


