# Distill Project Context

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
