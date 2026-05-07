# Distill 0.1.36 Release Notes

## Summary

Distill 0.1.36 adds packet-level sync session KDF metadata for encrypted sync packets.

## Changes

- New encrypted sync packets include top-level `syncKdf` metadata.
- All records in a newly built encrypted sync packet are encrypted with one non-exportable WebCrypto sync session key instead of deriving a separate key for every record.
- Decryption derives one non-exportable sync session key per packet when `syncKdf` is present.
- Legacy encrypted sync packets without packet-level `syncKdf` remain readable through the existing per-record envelope KDF fallback.
- Added regression tests for shared packet KDF metadata, legacy packet fallback, and tampered packet-level KDF rejection.

## Verification

- `npm test`: 65 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed.
- Release artifact SHA256: `FAF99C185CC8A9A5284A9A976DCFC18FBE0B2A1702DB4A8B27B7C66A136704F7`.

## Security Notes

This reduces repeated per-record key derivation and keeps the active sync record key non-exportable inside WebCrypto for the lifetime of one packet operation. The vault passphrase is still needed to derive packet sessions, so the next major sync security step remains a dedicated cross-device sync-key lifecycle and automatic transport design.
