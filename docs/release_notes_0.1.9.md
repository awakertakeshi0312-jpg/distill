# Distill 0.1.9 Release Notes

## Summary

Distill 0.1.9 improves encrypted vault operations after the 0.1.8 local-vault release. Users can now change the active vault passphrase and configure automatic locking from the Inspector.

## Changes

- Adds vault passphrase change flow.
- Verifies the current passphrase before re-encrypting the vault.
- Cancels pending old-passphrase autosaves before saving with the new passphrase.
- Adds auto-lock setting: off, 5, 15, 30, or 60 minutes.
- Locks the vault when the app document becomes hidden.
- Adds E2E coverage proving the old passphrase stops unlocking after passphrase change.
- Updates vault/security/roadmap/handoff documentation.

## Security Notes

- Content remains encrypted at rest.
- The passphrase and decrypted store still live in app memory while unlocked.
- Auto-lock reduces exposure during unattended sessions but does not replace OS-level device security.
- Record-level encrypted sync is still future work.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
