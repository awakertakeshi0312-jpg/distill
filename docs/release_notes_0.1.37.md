# Distill 0.1.37 Release Notes

## Summary

Distill 0.1.37 adds the first dedicated cross-device sync key foundation.

## Changes

- Adds `SyncKeyMaterial` to encrypted sync metadata inside the vault.
- New sync exports create/reuse dedicated sync key material instead of using only the vault passphrase as sync packet material.
- New encrypted sync packets can include `syncKeyId` plus a passphrase-wrapped `wrappedSyncKey` bootstrap envelope for first import and recovery.
- Decryption now prefers a matching local sync key, can unwrap the sync key with the vault passphrase when needed, and keeps legacy passphrase-based packet compatibility.
- Sync apply/revoke/forget paths preserve local sync key material so incoming packets cannot accidentally remove it.
- The sync panel copy now describes the dedicated sync-key bootstrap model.
- Added regression tests for local sync-key decrypt, wrapped-key fallback, discovered-key callback, and preserving local sync key material through sync apply.

## Verification

- `npm test`: 67 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed.
- Release artifact SHA256: `834DD008E1DE7F64CAC9D430A072B58EC1A8E7F696E8F0050E13832F112BD2A7`.

## Security Notes

This is a foundation, not automatic cloud sync. The sync key is stored inside the encrypted vault and wrapped into new packets with the vault passphrase for bootstrap/recovery. The next step is UX around sync-key lifecycle, device loss, and automatic transport while keeping apply manual until recovery drills are proven.
