# Distill 0.1.45 Release Notes

## Summary

Distill 0.1.45 is a desktop reliability hotfix for the installed app opening to a blank white window after updates. The fix targets stale WebView2 Service Worker/cache state without touching the encrypted vault database or backups.

## Changes

- Disables browser Service Worker registration when Distill is running inside the Tauri desktop runtime.
- Unregisters previously registered desktop Service Workers and deletes old `distill-shell-*` caches when the frontend can load.
- Adds a native one-time startup cleanup for `C:\Users\awake\AppData\Local\app.distill.local\EBWebView`.
- Guards the native cleanup so only the expected `app.distill.local\EBWebView` cache directory is removable.
- Updates the browser/PWA Service Worker to prefer network responses for JS/CSS/assets so stale bundles are less likely to survive browser updates.
- Documents the safe manual recovery path in `docs/desktop_troubleshooting.md`.

## Verification

- `npm test`: 78 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 20 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:check`: passed.
- Release artifact SHA256: `73981F6CC722BD756E6A256EFD95D333C44A0D736162ED30F13E59132F59A608`.

## Security Notes

The cleanup is intentionally limited to the WebView cache folder under local app data. It does not delete `distill.sqlite3`, encrypted vault backups, sync recovery snapshots, or any files under the roaming app data vault location.
