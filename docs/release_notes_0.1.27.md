# Distill 0.1.27 Release Notes

## Summary

Distill 0.1.27 adds source-device verification codes for first trust of signed sync packets.

## Changes

- Derives a human-checkable SHA-256 fingerprint from each device signing public key.
- Shows this device's verification code in the encrypted sync panel.
- Includes verification payload text for later QR/mobile pairing.
- Adds incoming source-device fingerprint display in sync previews.
- Requires typing the source-device verification code before applying a first-seen signed sync packet.
- Keeps legacy unsigned first-seen packets behind the existing explicit trust confirmation.
- Adds regression coverage for fingerprint formatting and matching.

## Verification

- `npm test`: 51 passed.
- `npm run build`: passing.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run test:rust`: 18 passed.
- `npx playwright test`: 10 passed.
- `npm run release:windows`: generated signed Windows installer, signature, and latest.json.
- `npm run release:check`: release readiness passed.
- Installer SHA256: `A41DFFB8529A6CF99D7263A75535D63DD9EE62088156E40F490280F47F294CCC`.

## Security Notes

This improves first-trust ceremony for signed sync packets by making users compare the source device public-key fingerprint out-of-band. It is still not a full mobile QR pairing flow; actual QR rendering/scanning and device removal beyond revocation remain future work.
