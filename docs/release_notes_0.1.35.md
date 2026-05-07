# Distill 0.1.35 Release Notes

## Summary

Distill 0.1.35 adds a non-exportable WebCrypto session key for normal unlocked vault persistence.

## Changes

- Adds `DistillVaultSession`, a non-exportable WebCrypto `CryptoKey` derived from the vault passphrase and stored only for the unlocked app session.
- Normal vault autosave now re-encrypts with the active session key instead of deriving from the passphrase on every save.
- New vault creation, existing vault unlock, and passphrase change now establish an active vault session key.
- Encrypted pre-sync recovery snapshots use the active vault session key.
- Existing vault envelopes remain compatible: unlock derives a session key from the existing envelope KDF metadata, and future saves keep the vault decryptable with the same passphrase.
- E2E timeout was raised to account for PBKDF2-heavy first-run vault setup on slower machines.
- Adds regression tests proving the session key is non-exportable and can round-trip vault persistence.

## Verification

- `npm test`: 64 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- Release artifact SHA256: `256B85F27C6CCBABC6D5C9C5EAE397D786015E68C5B9F9B8E61D60AD483B1B98`.

## Security Notes

Normal vault autosave no longer needs to use the passphrase directly after unlock. The passphrase still remains in a volatile app-session ref for sync packet decrypt/import/export because cross-device packets can use different envelope salts. The next major security step is a dedicated cross-device sync key model or platform keyring/Stronghold convenience unlock.
