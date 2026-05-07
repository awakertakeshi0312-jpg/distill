# Distill 0.1.30 Release Notes

## Summary

Distill 0.1.30 adds known-device forget/removal for the encrypted sync device registry.

## Changes

- Adds a sync metadata helper to forget a known non-current device without revoking it.
- Adds a Known devices action in the Inspector so stale or accidental device records can be removed locally.
- Preserves tombstones and revoked-device records when a known device is forgotten.
- Forces future packets from a forgotten device through the first-trust verification flow again.
- Keeps the current local device protected from accidental forget/removal.
- Adds regression coverage for known-device forget behavior.

## Verification

- `npm test`: 54 passed.
- `npm run build`: passing.
- Release artifact SHA256: `739FCE2A04E6D600C1F953D2B3A5250FC32910B16E086725D75331503745302C`.

## Security Notes

This improves local device lifecycle hygiene without enabling automatic inbound sync. Forgetting a device is intentionally different from revoking it: revoke blocks future packets, while forget removes the trusted record and makes future packets require verification again.