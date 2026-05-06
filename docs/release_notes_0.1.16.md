# Distill 0.1.16 Release Notes

## Summary

Distill 0.1.16 moves manual encrypted sync closer to practical multi-device use. It adds device trust revocation, desktop sync-folder packet exchange, and a current Japanese system design document for handoff and review.

## Changes

- Adds revoked sync devices to encrypted sync metadata.
- Lets users revoke known sync devices and reject future packets from those devices.
- Lets users forget a revoked-device record when they intentionally want to trust that device again.
- Carries revoked-device metadata through encrypted sync packets.
- Shows incoming revoked-device counts in the sync preview.
- Adds desktop sync-folder controls for writing encrypted sync packets into a folder, scanning packet candidates, and loading a selected packet into the existing preview/apply flow.
- Adds Tauri commands for sync-folder packet writing, scanning, and reading.
- Validates sync packet file names, packet schema, and packet size before desktop file operations.
- Adds a Japanese system design document covering product, architecture, vault, sync, mobile, security, and roadmap.
- Ignores local recovery artifacts created during white-screen/WebView cache recovery.

## Security Notes

- Sync-folder exchange is explicit and user-triggered; it is not background sync.
- Packet content remains record-level encrypted with the current vault passphrase.
- Revoked-device rejection is local trust metadata, not cryptographic device signing.
- Tauri validates packet shape and file name before reading or writing sync packet files.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
