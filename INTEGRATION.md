# AI Org Integration

## AI Org に送るイベント

- `thought.captured`: Inbox や Today に思考が保存された。
- `decision.created`: Distill 上で判断・方針がまとまった。
- `artifact.ready`: Markdown/JSON export、リリースノート、設計文書が準備できた。
- `memory.save_requested`: personal-km へ保存したい知識が発生した。
- `release.ready`: Windows build や signed updater が準備できた。
- `project.blocked`: vault、Tauri、Rust、署名、E2E が失敗した。

## AI Org から受け取るタスク

- 思考整理テンプレートやレビュー導線の改善。
- AI Secretary で生まれたメモの蒸留。
- personal-km の根拠検索結果を意思決定文書へ変換。
- Release Packet に基づく署名・配布準備。

## Event Emit

```powershell
$payload = Join-Path $env:TEMP "distill-org-event.json"
@{ decision = "shared protocol, not shared code" } | ConvertTo-Json -Compress | Set-Content -Path $payload -Encoding UTF8
npm run org:event -- --type decision.created --summary "共有作業プロトコルを採用" --payload-file $payload
```

送信前に確認する場合:

```powershell
npm run org:event -- --type decision.created --summary "共有作業プロトコルを採用" --payload-file $payload --dry-run
```

Work Packet の検証形式にも対応しています。

```powershell
node scripts/emit-org-event.js project.blocked --summary "smoke" --dry-run
```

## Artifact Register

```powershell
npm run org:artifact -- --title "Distill project context" --path PROJECT_CONTEXT.md --type project_doc --summary "Distill role, commands, boundaries, and completion criteria."
```

送信前に確認する場合:

```powershell
npm run org:artifact -- --title "Distill project context" --path PROJECT_CONTEXT.md --type project_doc --summary "Distill role, commands, boundaries, and completion criteria." --dry-run
```

## Work Packet 受け入れ条件

- `target_project` が `distill`。プロトコル文書で `target_project_id` と表記されている場合も、現在起動中のKernel APIでは `target_project` として扱う。
- `files_allowed` が `src/**`、`src-tauri/**`、`docs/**`、`scripts/**` のいずれかに限定されている。
- vault、backup、release signing、updater に触る変更は `approval_required` を true にする。
- `commands_to_verify` に `npm test` と `npm run build` を含める。

## Current Central Kernel Bridge

Default destination is the central file-based Kernel:

```text
C:\Users\awake\dev\active\ai-org-kernel
```

Use the project-specific wrappers for safe summary-only events:

```powershell
npm run org:decision -- --summary "Decision summary only"
npm run org:ready -- --title "Distill artifact" --path docs\ai_org_event_bridge.md --type project_doc --summary "Artifact summary only"
```

Use `--local-api` only when intentionally posting to the Personal KM local API.

## Approval Rules

ユーザー承認が必要:

- 外部送信
- 公開
- データ削除
- credential 変更
- 課金
- deploy
- git push

Kernel API へのローカル event/artifact 登録は、秘密情報やprivate note本文を含めない範囲で自動実行可能。
