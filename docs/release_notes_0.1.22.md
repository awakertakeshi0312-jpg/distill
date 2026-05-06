# Distill 0.1.22 Release Notes

## Summary

Distill 0.1.22 adds an in-app recovery path for encrypted pre-sync snapshots. Recovery points created before sync apply can now be listed, opened, decrypted, and routed through Restore preview before replacing the current vault.

## Changes

- Adds desktop commands to list and read encrypted pre-sync recovery snapshot files.
- Shows saved sync recovery snapshots in the encrypted vault section.
- Adds a refresh action for recovery snapshot discovery.
- Adds `Preview recovery` so a selected snapshot goes through Restore preview before apply.
- Extends Restore preview with a `sync-recovery` source kind.
- Keeps recovery snapshots encrypted; preview requires a vault passphrase.
- Adds Rust coverage for listing and reading only valid recovery snapshot files.
- Adds frontend coverage for the new restore preview source.

## Security Notes

- Recovery snapshot reads are constrained to the app recovery backup folder.
- Recovery files must match the `distill-pre-sync-*.json` shape and contain a Distill encrypted vault envelope.
- A recovery snapshot still does not replace the active vault until the user applies Restore preview.

## Verification

- `npm test`
- `npm run build`
- `npm run test:rust`
- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
