# Distill 0.1.7 Release Notes

## Summary

Distill 0.1.7 adds the first encrypted vault workflow and documents the sync model that should be used before real multi-device operation.

## Changes

- Adds passphrase-protected encrypted vault backups.
- Adds encrypted vault restore.
- Uses PBKDF2 SHA-256 and AES-256-GCM for `.distill-vault.json` files.
- Adds tests proving encrypted vault exports do not contain plaintext note content.
- Adds tests rejecting wrong passphrases.
- Adds a 5 MB import file cap for JSON, Markdown, and encrypted vault imports.
- Adds `docs/vault_encryption_design.md`.
- Adds `docs/sync_design.md`.
- Updates security and mobile strategy docs.

## Important Limit

The active local SQLite database is still not encrypted at rest. This release protects portable backups and defines the encrypted envelope for future sync, but full local vault encryption remains a later milestone.

## Verification

- `npm run check:all`
- `npm run security:audit`
