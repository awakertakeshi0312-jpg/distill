# Distill 0.1.46 Release Notes

## Summary

Distill 0.1.46 corrects the desktop white-screen cache cleanup path introduced in 0.1.45. The cleanup now targets the actual Windows WebView profile folder under `LOCALAPPDATA\app.distill.local\EBWebView`.

## Changes

- Uses `LOCALAPPDATA\app.distill.local\EBWebView` as the Windows desktop WebView cache cleanup target.
- Keeps the safety guard that refuses to clear any path that is not exactly under `app.distill.local\EBWebView`.
- Bumps the cleanup marker to `distill-webview-cache-cleanup-v2.done` so the corrected cleanup runs even if a previous install attempted the older cleanup.
- Keeps desktop Service Worker registration disabled and browser/PWA asset fetches network-first for JS/CSS/assets.

## Verification

- `npm test`: 78 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 20 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:check`: passed.
- Release artifact SHA256: `E3224AEB4986E9191FD89237DE71D6362328DFBB7AF5C92EF396EE6247912294`.

## Security Notes

The cleanup still does not touch the encrypted vault database, `Roaming\app.distill.local`, encrypted backups, or sync recovery snapshots.
