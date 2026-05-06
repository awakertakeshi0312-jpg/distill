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

## Work Packet 受け入れ条件

- `target_project` が `Distill`。
- `files_allowed` が `src/**`、`src-tauri/**`、`docs/**`、`scripts/**` のいずれかに限定されている。
- vault、backup、release signing、updater に触る変更は `approval_required` を true にする。
- `commands_to_verify` に `npm test` と `npm run build` を含める。
