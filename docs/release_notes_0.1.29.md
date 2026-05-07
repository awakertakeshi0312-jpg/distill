# Distill 0.1.29 Release Notes

## Summary

Distill 0.1.29 adds QR scanner and payload paste import for source-device verification.

## Changes

- Adds lazy-loaded camera QR scanning with `@zxing/browser`.
- Adds paste import for `distill-device-verification` QR payloads when camera access is unavailable.
- Verifies scanned payloads against the incoming sync packet source device ID, signing public key, and fingerprint.
- Fills the verification code only when the scanned or pasted payload matches the sync packet source.
- Keeps scanner code split out of the initial app bundle until camera scan is started.
- Adds regression coverage for parsing and resolving scanned verification payloads.

## Verification

- `npm test`: 53 passed.
- `npm run build`: passing.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run test:rust`: 18 passed.
- `npx playwright test`: 10 passed.
- `npm run release:windows`: generated signed Windows installer, signature, and latest.json.
- `npm run release:check`: release readiness passed.
- Installer SHA256: `F5F385F0C4A2180903C19B14E52DC29EFF4305385331638915E45929881C4D52`.

## Security Notes

This closes the manual QR pairing loop for signed sync packets without enabling automatic inbound sync. It still does not make inbound packets auto-apply, and mobile-native pairing polish remains future work.
