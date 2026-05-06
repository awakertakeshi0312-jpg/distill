# Distill Project Context

## Current Status (2026-05-06)

- Current version: 0.1.22.
- Current phase: Trust Layer / Phase 6 Sync hardening.
- Current completion estimate: 55% overall; this phase advanced +2pt in this pass.
- Implemented in this pass: in-app sync recovery snapshot listing, reading, and restore preview. Users can now preview a saved encrypted pre-sync recovery snapshot before replacing the current vault.
- Sync-folder packet statuses: ready, risk review, stale, blocked, checkpoint risk, invalid. Recommended preview never auto-applies, sync apply is gated by a local encrypted recovery snapshot, and saved recovery snapshots can be reopened through Restore preview.
- Still not implemented: automatic/background sync, mobile-native app, hosted E2EE sync, real vector search, Windows code-signing certificate.
- Primary docs: `docs/project_context.md`, `docs/roadmap.md`, `docs/sync_design.md`, `docs/release_notes_0.1.22.md`.
## 役割

思考の断片を捕まえ、タグ・リンク・検索・グラフ・レビューを通じて、判断や知識に蒸留するローカルファーストのデスクトップアプリ。

## 現在の状態

- 現在の公開版は `0.1.11`。
- Project ID は `distill`、AI Org 上の役割は Thinking Core。
- Kernel API は `http://localhost:3001/api/org`。
- React + TypeScript + Vite + Tauri。
- ブラウザ開発ポートは `4173`。
- encrypted local vault gate、パスフレーズ変更、自動ロック、ローカル保存を持つ。
- 手動の暗号化sync packet export/import、端末ID、端末レジストリ、削除tombstoneを持つ。
- Inbox、Today、Search、Graph、Projects、Archive、Export/Import、言語切替を実装済み。
- MVP は Windows で buildable。

## 起動コマンド

```powershell
cd C:\Users\awake\dev\active\distill
npm run dev
```

Tauri 開発:

```powershell
npm run tauri:dev:windows
```

## テストコマンド

```powershell
npm test
npm run build
npm run test:rust
npm run test:e2e
```

## 壊してはいけない境界

- 暗号化 vault、バックアップ、復元の互換性を壊さない。
- Tauri capability を不要に広げない。
- ユーザーのローカル思考データを外部送信しない。
- リリース署名・アップデータ導線を不用意に変更しない。

## 完成判定

- `npm run build` が成功する。
- `npm test` が成功する。
- `npm run test:rust` が成功する。
- `npm run test:e2e` が成功する。
- vault unlock、capture、search、export/import の主要導線が維持される。
- 判断や成果物を `decision.created` / `artifact.ready` として AI Org に送れる。
