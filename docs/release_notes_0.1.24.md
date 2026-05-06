# Distill 0.1.24 Release Notes

## Summary

Distill 0.1.24 adds outbound sync-folder auto-export. When enabled, Distill writes encrypted outbound sync packets when local sync content changes, while keeping incoming packet preview and apply fully manual.

## Changes

- Adds an auto-export toggle in the encrypted sync panel.
- Writes encrypted sync-folder packets only when local block, tombstone, revocation, or device-name content changes.
- Stores a local outbound content fingerprint to avoid repeatedly exporting the same payload after source-device checkpoint metadata changes.
- Keeps incoming packet preview, risk acknowledgement, recovery snapshot creation, and apply as explicit user actions.
- Preserves newer local UI changes when recording an export checkpoint.
- Adds auto-export status copy in English and Japanese.

## Security Notes

- Auto-export writes encrypted packets only.
- Auto-export does not read, preview, import, merge, or apply incoming packets.
- Incoming packets still go through safety scan, checkpoint validation, risk acknowledgement when needed, and encrypted pre-sync recovery snapshots before apply.
- The fingerprint intentionally excludes source-device checkpoint metadata to avoid infinite export loops.

## Verification

- `npm test`
- `npm run build`
- `npm run test:rust`
- `npx playwright test --reporter=json`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
