# Distill 0.1.39 Release Notes

## Summary

Distill 0.1.39 adds an in-app sync key recovery drill for device-loss readiness.

## Changes

- Adds a recovery drill action to the Inspector sync-key card.
- Builds a test encrypted outbound sync packet without applying inbound changes.
- Verifies the packet decrypts through both the local dedicated sync key and the passphrase-wrapped recovery copy.
- Verifies plaintext sync key material does not leak into the serialized encrypted packet.
- Persists the current device identity and sync-key metadata if the drill needs to initialize them.
- Adds regression coverage for the recovery drill result and wrapped-key rediscovery path.

## Verification

- `npm test`: 69 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `E0A1A716BB7BC7986AE21DFFC7976CA917708357F471CB52CD9E6E6A3E774209`.

## Security Notes

The drill is a dry-run verification path. It does not import, merge, or apply remote data. Automatic inbound apply remains disabled until recovery and rollback drills are repeatedly proven.
