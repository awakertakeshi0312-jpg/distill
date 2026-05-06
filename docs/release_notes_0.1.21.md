# Distill 0.1.21 Release Notes

## Summary

Distill 0.1.21 adds encrypted pre-sync recovery snapshots. Before a sync preview can be applied, Distill now saves the current encrypted vault as a local recovery point and refuses to merge the packet if that recovery save fails.

## Changes

- Adds a Tauri command for saving encrypted sync recovery vault snapshots.
- Saves recovery snapshots under the desktop app data backup area before sync apply.
- Keeps recovery snapshots encrypted with the current vault passphrase.
- Shows the saved recovery path after a successful sync apply.
- Blocks sync apply when the recovery snapshot cannot be saved.
- Adds Rust coverage for encrypted vault envelope validation and safe recovery file labels.

## Security Notes

- The recovery snapshot is an encrypted vault envelope, not plaintext notes.
- Sync preview still does not auto-apply.
- Destructive or tie-break sync packets still require explicit risk acknowledgement.
- Recovery snapshot labels are sanitized before they become file names.

## Verification

- `npm test`
- `npm run build`
- `npm run test:rust`
- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
