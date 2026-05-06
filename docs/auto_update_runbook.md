# Distill Auto Update Release Runbook

Distill uses the Tauri v2 updater plugin for signed automatic updates.

## What Is Implemented

- `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` are installed.
- Rust updater plugin is registered in `src-tauri/src/lib.rs`.
- `src-tauri/tauri.conf.json` contains the updater public key and endpoint.
- The Inspector update section can check the signed update feed and install an available update.
- Manual installer launch remains as a fallback.
- `scripts/build-signed-updater.ps1` builds, signs, and creates release files.
- `scripts/create-latest-json.ps1` creates the updater `latest.json` manifest.

## Secret Key

Private key location on this machine:

```text
C:\Users\awake\.tauri\distill.key
```

Public key location:

```text
C:\Users\awake\.tauri\distill.key.pub
```

Do not commit or share the private key. If it is lost, already-installed apps cannot receive future signed updates from this key.

## Release Files

After running the release command, upload everything in `release/`:

```text
release/Distill_0.1.1_x64-setup.exe
release/Distill_0.1.1_x64-setup.exe.sig
release/latest.json
```

`latest.json` must contain a `platforms.windows-x86_64` entry. The updater does not accept a top-level `url` and `signature` pair for this static JSON configuration.

Current local release SHA256:

```text
5E13BA109491348C58B00A498FBFA5396CD906263A70619D3DF3F1FD77A2CC81
```

The app currently checks this endpoint:

```text
https://github.com/awakertakeshi0312-jpg/distill/releases/latest/download/latest.json
```

If the GitHub repository or release host changes, update `plugins.updater.endpoints` in `src-tauri/tauri.conf.json`.

## Build A Signed Windows Update

```powershell
npm run release:windows
```

If the full release command hangs, use the stable split flow:

```powershell
npm run tauri:build:windows
npm run tauri signer sign -- --private-key-path "$env:USERPROFILE\.tauri\distill.key" --password= src-tauri\target\release\bundle\nsis\Distill_0.1.1_x64-setup.exe
npm run release:latest-json
```

## Manual Publish Steps

1. Create a GitHub release.
2. Upload `release/Distill_0.1.1_x64-setup.exe`.
3. Upload `release/Distill_0.1.1_x64-setup.exe.sig`.
4. Upload `release/latest.json`.
5. Open the installed app.
6. Press `更新を確認` in Inspector.
7. If an update is available, press `更新をインストール`.

## Important Version Rule

Tauri updater only detects an update when the release manifest version is newer than the installed app version. For the real next update, bump both:

- `package.json` version
- `src-tauri/tauri.conf.json` version

Example: change `0.1.1` to the next version, for example `0.1.2`, then build and publish.

Do not expect an app to update to another build with the same version. The updater intentionally ignores same-version releases.

## References

- https://v2.tauri.app/ja/plugin/updater/

