# Distill 0.1.34 Release Notes

## Summary

Distill 0.1.34 hardens the unlocked vault session by moving active passphrase handling out of React state and into a volatile in-memory session ref.

## Changes

- Replaces React state passphrase storage with a volatile app-session ref while the vault is unlocked.
- Autosave, sync export, sync preview, recovery snapshot, and passphrase-change paths now read the passphrase only from the active unlocked session.
- Adds a small vault session policy module for auto-lock normalization and idle expiry checks.
- Normalizes auto-lock settings into a bounded policy range before saving.
- Adds regression tests for vault session policy.
- Keeps the existing manual lock, lock-on-hidden, and idle lock behavior intact.

## Verification

- `npm test`: 62 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- Release artifact SHA256: `40AA07EE4E1FE80F43B1ACDA1315C8A4C91163A8C630B5FC29B372DEB1D02B89`.

## Security Notes

This reduces accidental passphrase retention through React state snapshots and rerenders, but it is not a full keyring or non-exportable CryptoKey design yet. The next hardening step is deriving a non-exportable session CryptoKey or integrating a platform key store such as Tauri Stronghold/keyring for convenience unlock.
