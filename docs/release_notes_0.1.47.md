# Distill 0.1.47 Release Notes

## Summary

Distill 0.1.47 moves the Windows WebView cache cleanup into the NSIS installer preinstall hook. This fixes the remaining white-screen recovery gap where the app could recreate or lock the WebView cache before runtime cleanup could remove it.

## Changes

- Adds `src-tauri/windows/nsis-hooks.nsh` with an `NSIS_HOOK_PREINSTALL` cleanup.
- Removes `LOCALAPPDATA\app.distill.local\EBWebView` while Distill is closed during install/update.
- Writes `APPDATA\app.distill.local\distill-webview-cache-cleanup-v3.done` so runtime cleanup does not fight the new fresh WebView profile.
- Keeps runtime cleanup as a fallback for non-installer startup paths.
- Keeps desktop Service Worker registration disabled and browser/PWA asset fetches network-first for JS/CSS/assets.

## Verification

- `npm test`: 78 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 20 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:check`: passed.
- Installed app check: passed; installer removed existing `EBWebView`, wrote `distill-webview-cache-cleanup-v3.done`, and the app relaunched with a fresh WebView cache.
- Release artifact SHA256: `62B6DD57A09B820E3B51E5B523F344B15F49B12DF7821EFF7E9B7F4C006E661E`.

## Security Notes

The installer cleanup is scoped to `LOCALAPPDATA\app.distill.local\EBWebView` only. It does not touch the encrypted vault database, `APPDATA\app.distill.local\distill.sqlite3`, encrypted backups, or sync recovery snapshots.
