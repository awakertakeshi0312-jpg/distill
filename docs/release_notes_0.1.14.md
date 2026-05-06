# Distill 0.1.14 Release Notes

## Summary

Distill 0.1.14 adds an apply-before-confirm preview for encrypted sync packet imports. Manual sync now shows what will be added, updated, skipped, or deleted before the vault changes.

## Changes

- Adds sync packet preview calculation in `src/syncPreview.ts`.
- Changes encrypted sync import from immediate merge to preview-first flow.
- Shows incoming records, devices, block additions, block updates, skipped blocks, and deletion effects in the Inspector.
- Lets users apply or cancel a sync preview.
- Shows stale or already imported packets as skipped previews.
- Adds unit coverage for sync preview counts and replay previews.
- Updates sync, roadmap, security, and project context docs.

## Security Notes

- Sync records are still encrypted before export.
- Imported sync records are decrypted only in memory after the vault is unlocked.
- Preview calculation uses the same deterministic merge policy as sync application.
- Replay/rollback protection still uses source-device `lastPacketAt`; stronger chained checkpoint validation remains future work.

## Verification

- `npm test`
- `npm run build`
- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
