# Distill 0.1.33 Release Notes

## Summary

Distill 0.1.33 moves browser/PWA encrypted vault persistence from localStorage-first to IndexedDB-first storage.

## Changes

- Adds an IndexedDB-backed encrypted browser vault store.
- Browser/PWA mode now saves the encrypted normal vault envelope to IndexedDB when available.
- Existing encrypted `localStorage:distill.vault.v1` values are migrated into IndexedDB on load.
- After a successful IndexedDB save or migration, the old encrypted localStorage vault copy is removed.
- Browser sync recovery snapshots also use the same IndexedDB encrypted value store when available.
- localStorage remains a fallback only when IndexedDB is unavailable or fails.
- Storage diagnostics now show an `indexedDB:distill-browser-vault/vaults/...` path in browser/PWA mode.
- Adds regression tests for browser vault storage planning and E2E coverage proving browser persistence survives reload through IndexedDB without leaving a localStorage vault copy.

## Verification

- `npm test`: 60 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- Release artifact SHA256: `D91A36CF94A71953D3A7C8E02FBE21045372B32E2D5D1DC8212768615038F0AC`.

## Security Notes

This improves the browser/PWA storage boundary but does not make PWA sync production-ready. The encrypted vault is still this-device-only, and stronger session-key handling plus E2EE transport are still required before mobile sync becomes a production feature.
