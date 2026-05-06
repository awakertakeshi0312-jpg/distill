# MVP QA Checklist

Date: 2026-05-06
Build: 0.1.1

## Automated Verification

- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `npm run test:rust` passes.
- [x] `npm run check:all` passes.
- [x] `npm run tauri:build:windows` produces an NSIS installer.
- [x] `npm run test:e2e` passes Japanese default UI, browser MVP, JSON restore, Markdown import, edit/archive/restore, export, people/graph, and project persistence smoke flows.
- [x] Installed app process, SQLite store, normalized indexes, and automatic backup verified in `docs/installed_app_qa_2026-05-06.md`.

## Manual Smoke Test

Use `npm run tauri:dev:windows` or install the generated NSIS package.

- [x] App opens to Distill shell.
- [ ] Language toggle switches English/Japanese.
- [x] Capture creates a new inbox block.
- [x] `#tag` and `[[Link]]` are extracted from a capture.
- [x] Inline edit updates content, tags, and links.
- [x] Search returns matching blocks with evidence pills.
- [x] Search returns semantic-overlap matches when exact words differ.
- [x] Project assignment persists after app restart.
- [x] Archive hides a block from active views.
- [x] Restore brings an archived block back.
- [x] People index detects `@name`, `[[Person: Name]]`, and `[[People/Name]]`.
- [x] Graph displays blocks/projects/people/concepts.
- [x] Graph edge filter changes visible relationships.
- [x] Graph neighbor list updates when selecting a node.
- [x] Markdown export downloads a readable file.
- [x] JSON export downloads a portable store snapshot.
- [x] JSON restore imports a validated backup after confirmation.
- [x] JSON backup downloads a timestamped backup file.
- [x] Automatic latest backup path is visible.
- [x] Markdown import appends bullet notes without replacing the current store.
- [x] Inspector displays the active storage path.
- [ ] First-run onboarding can be dismissed.
- [ ] Update launcher starts a newer Distill setup package in installed desktop mode.

## Release Artifact

```text
src-tauri/target/release/bundle/nsis/Distill_0.1.1_x64-setup.exe
```

Expected SHA256:

```text
5E13BA109491348C58B00A498FBFA5396CD906263A70619D3DF3F1FD77A2CC81
```

Verify with:

```powershell
Get-FileHash src-tauri\target\release\bundle\nsis\Distill_0.1.1_x64-setup.exe -Algorithm SHA256
```

## Known MVP Limits

- Installer is unsigned.
- Semantic search uses local overlap aliases, not embeddings/vector indexes.
- Sync is not implemented.
- Graph data is regenerated on full-store saves rather than incrementally updated.



