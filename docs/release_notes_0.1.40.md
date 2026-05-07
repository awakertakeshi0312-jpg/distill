# Distill 0.1.40 Release Notes

## Summary

Distill 0.1.40 adds a multi-device sync recovery drill for A/B device-loss readiness.

## Changes

- Adds an A/B drill action to the Inspector sync-key card.
- Simulates device A exporting an encrypted packet, recovery device B recovering the dedicated sync key through the passphrase-wrapped bootstrap copy, and B returning an encrypted packet that A can decrypt with the local sync key.
- Keeps the drill dry-run only: it does not apply remote changes to the active vault.
- Checks that both bootstrap and return packets contain recoverable wrapped sync-key metadata and do not serialize plaintext sync-key material.
- Adds unit coverage for the multi-device drill result, record counts, source/recovery device ids, and packet timestamps.

## Verification

- `npm test`: 70 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `A5E16A0F7474147C4644B7E0202B2CD7136518708DF42FFDA6770B7698C8EE13`.

## Security Notes

This is still a drill, not automatic sync. It proves the current packet format can bootstrap a second device and round-trip back to the source device without exposing sync-key plaintext. Automatic inbound apply remains disabled.
