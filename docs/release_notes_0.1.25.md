# Distill 0.1.25 Release Notes

## Summary

Distill 0.1.25 hardens inbound encrypted sync by adding an explicit trust confirmation gate for first-seen source devices.

## Changes

- Added sync preview awareness for whether the source device is already known in the local encrypted vault.
- Added an unknown-device trust confirmation checkbox before applying a first-seen source-device packet.
- Updated sync-folder safety scan so unknown source devices are classified as risk review instead of ready.
- Kept inbound sync manual: no incoming packet is auto-applied.
- Added regression coverage for unknown vs trusted source-device preview behavior.

## Verification

- `npm test`: 47 passed.
- `npm run build`: passing.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run test:e2e`: 10 passed.
- `npm run release:check`: passing.

## Security Notes

This is not cryptographic device signing yet. It is a user-visible trust gate that prevents accidental first import from an unknown source device before the later signed-checkpoint/device-key phase.
