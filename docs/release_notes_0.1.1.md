# Distill 0.1.1 Release Notes

Date: 2026-05-06
Build: 0.1.1

## Purpose

This release is the first signed-update test build for the public GitHub release endpoint:

```text
https://github.com/awakertakeshi0312-jpg/distill/releases/latest/download/latest.json
```

It is intended to be published after `0.1.0` has been installed, so the in-app updater can detect `0.1.1` as newer.

## Changes

- Updated application version to `0.1.1` across `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- Changed updater endpoint to `awakertakeshi0312-jpg/distill`.
- Generated signed Windows installer.
- Generated updater signature file.
- Generated `latest.json` update manifest.

## Release Files

```text
release/Distill_0.1.1_x64-setup.exe
release/Distill_0.1.1_x64-setup.exe.sig
release/latest.json
```

SHA256:

```text
5E13BA109491348C58B00A498FBFA5396CD906263A70619D3DF3F1FD77A2CC81
```

## Verification

- `npm run release:windows`: passed.
- `npm run check:all`: passed.
- Frontend/domain tests: 17 passed.
- Rust/SQLite tests: 8 passed.
- Browser E2E smoke tests: 9 passed.
- Update signature matches `latest.json`.

## Publish Requirement

Upload all three files in `release/` to GitHub Release tag `v0.1.1`.
