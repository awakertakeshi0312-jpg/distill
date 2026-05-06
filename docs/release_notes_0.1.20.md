# Distill 0.1.20 Release Notes

## Summary

Distill 0.1.20 adds an assisted sync-folder preview step. After a safety scan, Distill can open the preview for exactly one unambiguous safe packet, while still requiring the user to apply the sync manually.

## Changes

- Adds a `Recommended preview` action to the sync-folder controls.
- Reuses the local safety scan before recommending any packet.
- Auto-opens preview only when there is exactly one `ready` packet.
- Refuses automatic preview when there are multiple ready packets, risk-review packets, blocked packets, checkpoint-risk packets, or invalid packets.
- Keeps sync apply fully manual; this release does not add background sync or auto-apply.
- Adds unit coverage for sync-folder status counting and assisted preview selection.

## Security Notes

- Recommended preview reads and decrypts candidates only in memory with the unlocked vault passphrase.
- No sync packet is applied automatically.
- Risky or ambiguous folder states force manual packet selection.

## Verification

- `npm test`
- `npm run build`
- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`