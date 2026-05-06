# Distill 0.1.26 Release Notes

## Summary

Distill 0.1.26 adds signed device checkpoints for encrypted sync packets.

## Changes

- Generates a local per-device ECDSA P-256 signing key pair.
- Signs outbound encrypted sync packets with the local device private key.
- Stores trusted source-device public keys in sync metadata.
- Verifies trusted-device signatures before applying sync packets.
- Blocks trusted-device key mismatch, missing trusted signatures, unsupported signatures, and tampered signed payloads.
- Keeps first-seen source devices in risk review until the user explicitly confirms device trust.
- Shows device signature status in sync preview and sync-folder packet review.
- Added regression coverage for signed, trusted, mismatched, and tampered packet behavior.

## Verification

- `npm test`: 50 passed.
- `npm run build`: passing.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run test:rust`: 18 passed.
- `npx playwright test`: 10 passed.
- `npm run release:windows`: generated signed Windows installer, signature, and latest.json.
- `npm run release:check`: release readiness passed.
- Installer SHA256: `9D78EF255F65953B911E12B0174F52B6D1C2A32240BB5EF4AA114575BC01FCE0`.

## Security Notes

This is a cryptographic checkpoint layer, not yet a complete new-device verification ceremony. First trust still depends on the user confirming the source device. A later phase should add QR/fingerprint comparison so users can verify a new device public key out-of-band before trusting it.
