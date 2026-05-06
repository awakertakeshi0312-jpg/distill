# Distill 0.1.23 Release Notes

## Summary

Distill 0.1.23 adds a monitor-only sync-folder review queue. When enabled, Distill refreshes the encrypted sync folder safety scan every minute, updates the review list, and still requires the user to manually preview and apply any packet.

## Changes

- Adds a sync-folder monitor toggle in the encrypted sync panel.
- Persists the monitor preference locally.
- Refreshes the safety review queue on a one-minute interval while the vault is unlocked.
- Shows the last monitor check time.
- Keeps recommended preview and sync apply as explicit user actions.
- Adds monitor status copy in English and Japanese.

## Security Notes

- Monitoring does not auto-preview packets.
- Monitoring does not auto-apply packets.
- Existing revoked-device, checkpoint, stale-packet, risk-review, and invalid-packet classifications remain in force.
- Sync apply remains gated by explicit preview, risk acknowledgement when needed, and an encrypted pre-sync recovery snapshot.

## Verification

- `npm test`
- `npm run build`
- `npm run test:rust`
- `npx playwright test --reporter=json`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
