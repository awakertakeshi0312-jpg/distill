# Distill 0.1.42 Release Notes

## Summary

Distill 0.1.42 adds an in-app device-loss recovery runbook so sync readiness is visible before relying on a second device.

## Changes

- Adds a pure device-loss runbook readiness model for sync-key, source-device verification, partner device, sync-folder transport, recovery snapshot, dry-run drill, and rollback drill coverage.
- Adds a recovery runbook card to the Inspector sync panel with ready/setup/check statuses.
- Scores the current setup as setup required, usable with cautions, or ready.
- Adds Japanese and English runbook labels.
- Adds unit coverage for unprepared and fully prepared desktop recovery setups.

## Verification

- `npm test`: 73 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `git diff --check`: passing.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `71EA0DBC3F647289DDC3B5D020D47C83E40039E9100261E6D1846AB1D790B73E`.

## Security Notes

This does not enable automatic inbound sync. It makes device-loss preparedness explicit before production transport: users can see whether sync key bootstrap, out-of-band device verification, recovery snapshots, dry-run drills, and rollback checks are in place.
