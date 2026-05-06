# Distill Updater Fix 0.1.3 To 0.1.4

## Root Cause

The updater failed for two reasons:

1. The old `latest.json` used top-level `url` and `signature` fields. Tauri v2 static updater requires `platforms.windows-x86_64.url` and `platforms.windows-x86_64.signature`.
2. The app capability file only granted `core:default`. The frontend updater API also requires `updater:default`.

## Fix

`src-tauri/capabilities/default.json` now includes:

```json
"permissions": [
  "core:default",
  "updater:default"
]
```

`release/latest.json` now uses the Tauri v2 static updater structure.

## Required Test Sequence

1. Manually install the fixed baseline:

```text
C:\Users\awake\dev\active\distill\release_archive\v0.1.3\Distill_0.1.3_x64-setup.exe
```

2. Publish GitHub release `v0.1.4` with:

```text
C:\Users\awake\dev\active\distill\release\Distill_0.1.4_x64-setup.exe
C:\Users\awake\dev\active\distill\release\Distill_0.1.4_x64-setup.exe.sig
C:\Users\awake\dev\active\distill\release\latest.json
```

3. Open Distill 0.1.3.

4. Press `更新を確認`.

Expected result:

```text
更新 0.1.4 が利用できます。
```

5. Press `更新をインストール`.

## Artifact Hashes

0.1.3 manual baseline:

```text
108E20BA068FE9506B5D5EBB98592DA3EF611A44C7A287987EC58C8D16B04108
```

0.1.4 update artifact:

```text
EB0B0BB7D1DE597C0879389C55E2948A02F331D0BEF0978B4B7BB380CF692D20
```

## Verification

- `npm run release:windows`: passed for 0.1.3 and 0.1.4.
- `npm run check:all`: passed on 0.1.4.
- Frontend/domain tests: 17 passed.
- Rust/SQLite tests: 8 passed.
- Browser E2E smoke tests: 9 passed.
