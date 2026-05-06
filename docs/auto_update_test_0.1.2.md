# Distill 0.1.2 Auto-Update Test Steps

Current state:

- `v0.1.1` is published on GitHub.
- Local `release/` now contains `v0.1.2` update files.
- Local `release_archive/v0.1.1/` contains the `v0.1.1` installer for manual installation.

## Required Manual Order

1. Install `0.1.1` manually once:

```text
C:\Users\awake\dev\active\distill\release_archive\v0.1.1\Distill_0.1.1_x64-setup.exe
```

This ensures the installed app points to:

```text
https://github.com/awakertakeshi0312-jpg/distill/releases/latest/download/latest.json
```

2. Publish GitHub release `v0.1.2` with these three files:

```text
C:\Users\awake\dev\active\distill\release\Distill_0.1.2_x64-setup.exe
C:\Users\awake\dev\active\distill\release\Distill_0.1.2_x64-setup.exe.sig
C:\Users\awake\dev\active\distill\release\latest.json
```

The `latest.json` file must use the Tauri v2 static updater shape:

```json
{
  "version": "0.1.2",
  "pub_date": "...",
  "notes": "...",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/awakertakeshi0312-jpg/distill/releases/latest/download/Distill_0.1.2_x64-setup.exe"
    }
  }
}
```

The older top-level `url` and `signature` shape is invalid for this updater configuration.

3. Open the installed `0.1.1` Distill app.

4. Press `更新を確認`.

5. Press `更新をインストール` when `0.1.2` is detected.

## 0.1.2 Artifact

SHA256:

```text
638199AEF954C0416897C6C00603981844FAEE883F04709C64CE7076CB2B9A82
```

Signature file matches `latest.json`.
