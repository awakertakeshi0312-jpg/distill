# Distill Project Context

## Current Status (2026-05-07)

- Current version: 0.1.39.
- Current phase: Sync-key recovery drill and Trust Layer sync hardening.
- Current completion estimate: 95% overall; this phase advanced +1pt in this pass.
- Implemented in this pass: Distill now exposes an in-app sync-key recovery drill that verifies a dry-run encrypted packet can be decrypted by both the local dedicated sync key and the passphrase-wrapped recovery copy, while checking that plaintext sync-key material is not serialized.
- Sync-folder packet statuses: ready, risk review, stale, blocked, checkpoint risk, invalid. Monitoring and outbound auto-export never auto-apply incoming packets; sync apply is now gated by signature verification for trusted devices, source-device verification code confirmation when needed, local risk acknowledgement for destructive decisions, and a local encrypted recovery snapshot.
- Still not implemented: automatic inbound sync/apply, native iOS/Android app packaging, hosted E2EE sync, real vector search, Windows code-signing certificate, polished native mobile pairing flow, record-level normal vault persistence, and production mobile sync transport.
- Primary docs: `docs/project_context.md`, `docs/roadmap.md`, `docs/sync_design.md`, `docs/release_notes_0.1.39.md`.
## 役割

思老E�E断牁E��捕まえ、タグ・リンク・検索・グラフ�Eレビューを通じて、判断めE��識に蒸留するローカルファースト�EチE��クトップアプリ、E
## 現在の状慁E
- 現在の公開版は `0.1.11`、E- Project ID は `distill`、AI Org 上�E役割は Thinking Core、E- Kernel API は `http://localhost:3001/api/org`、E- React + TypeScript + Vite + Tauri、E- ブラウザ開発ポ�Eト�E `4173`、E- encrypted local vault gate、パスフレーズ変更、�E動ロチE��、ローカル保存を持つ、E- 手動の暗号化sync packet export/import、端末ID、端末レジストリ、削除tombstoneを持つ、E- Inbox、Today、Search、Graph、Projects、Archive、Export/Import、言語�E替を実裁E��み、E- MVP は Windows で buildable、E
## 起動コマンチE
```powershell
cd C:\Users\awake\dev\active\distill
npm run dev
```

Tauri 開発:

```powershell
npm run tauri:dev:windows
```

## チE��トコマンチE
```powershell
npm test
npm run build
npm run test:rust
npm run test:e2e
```

## 壊してはぁE��なぁE��E��

- 暗号匁Evault、バチE��アチE�E、復允E�E互換性を壊さなぁE��E- Tauri capability を不要に庁E��なぁE��E- ユーザーのローカル思老E��ータを外部送信しなぁE��E- リリース署名�EアチE�EチE�Eタ導線を不用意に変更しなぁE��E
## 完�E判宁E
- `npm run build` が�E功する、E- `npm test` が�E功する、E- `npm run test:rust` が�E功する、E- `npm run test:e2e` が�E功する、E- vault unlock、capture、search、export/import の主要導線が維持される、E- 判断めE�E果物めE`decision.created` / `artifact.ready` として AI Org に送れる、E