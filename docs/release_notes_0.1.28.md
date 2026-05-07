# Distill 0.1.28 Release Notes

## Summary

Distill 0.1.28 adds QR display for source-device verification payloads.

## Changes

- Adds the `qrcode` renderer for local device verification payloads.
- Shows a scannable QR code next to this device's verification fingerprint in the sync panel.
- Keeps the raw QR payload in a collapsible details section for debugging and future mobile pairing.
- Keeps first-seen signed sync packets gated by source-device verification code entry before apply.
- Adds regression coverage for parseable device verification payloads.

## Verification

- `npm test`: 52 passed.
- `npm run build`: passing.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run test:rust`: 18 passed.
- `npx playwright test`: 10 passed.
- `npm run release:windows`: generated signed Windows installer, signature, and latest.json.
- `npm run release:check`: release readiness passed.
- Installer SHA256: `AE6D32E8FABC8150282D2FA3369AAA32F96C74DAA006F82CC9836D45A43E23C7`.

## Security Notes

This improves the out-of-band first-trust flow by making the source device verification payload scannable. It does not yet include camera scanning or automatic QR import on another device.
