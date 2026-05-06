# Distill 0.1.8 Release Notes

## Summary

Distill 0.1.8 turns the encrypted vault from a backup-only feature into the normal local persistence boundary. The app now starts locked, stores active data as an encrypted vault envelope, migrates existing plaintext local data, and avoids persistent plaintext search/graph indexes.

## Changes

- Adds startup vault setup/unlock screen.
- Stores normal app state as `distill.vault.v1` encrypted vault data.
- Migrates legacy plaintext local data into the encrypted vault on first setup.
- Clears known plaintext legacy SQLite tables, legacy JSON key, and old plaintext auto backup after migration.
- Writes desktop encrypted latest backup to `backups/distill-encrypted-vault-latest.json`.
- Uses in-memory search and graph after vault unlock.
- Removes plaintext save/search/graph commands from the Tauri frontend capability exposure.
- Adds a visible vault lock button in the top bar.
- Updates E2E tests for vault creation/unlock and encrypted persistence after reload.
- Updates vault, sync, security, and project context documentation.

## Security Notes

- Content is encrypted at rest after vault creation/migration.
- The passphrase and decrypted store still live in app memory while unlocked.
- The current format encrypts the whole store as one envelope, not individual records.
- Sync remains disabled until record-level encrypted sync is designed.

## Verification

- `npm run check:all`
- `npm run security:audit`
