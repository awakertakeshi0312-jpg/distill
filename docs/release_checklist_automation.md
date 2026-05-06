# Distill Release Checklist Automation

`npm run release:check` performs a read-only release readiness preflight for the
current local `release/` directory.

It verifies:

- `package.json` version matches `src-tauri/tauri.conf.json`.
- `release/latest.json` exists, parses as JSON, has no BOM, and matches the
  package version.
- `platforms.windows-x86_64` exists.
- the updater endpoint points to `latest.json`.
- the installer URL filename matches the current version.
- the local installer and `.sig` files exist.
- the signature in `latest.json` matches the `.sig` file.
- `docs/release_manifest_<version>.json` matches installer path, signature path,
  `latest.json`, byte count, SHA-256, and update URL.

Safety boundary:

- The command does not build.
- The command does not sign.
- The command does not upload.
- The command does not mutate release files.

Use this before public distribution:

```powershell
npm run check:all
npm run security:audit
npm run release:windows
npm run release:check
```

Uploading installer, signature, and `latest.json` to GitHub Releases remains a
manual release action and should only happen intentionally.

Associated Work Packet:

```text
wp_20260506_add-distill-release-checklist-automation
```
