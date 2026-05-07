# Distill 0.1.44 Release Notes

## Summary

Distill 0.1.44 turns the encrypted vault record-log foundation into a shadow persistence path. The stable whole-vault save remains the source of truth, while Distill now also writes a replayable encrypted record log and exposes an Inspector verification action.

## Changes

- Adds encrypted vault-record envelope support tied to the active non-exportable Vault session key.
- Writes a `distill.vaultRecordLog.v1` shadow save after successful whole-vault persistence.
- Stores the shadow log in desktop SQLite `app_store` and browser IndexedDB/localStorage fallback storage.
- Adds Tauri commands and capability permissions for record-log load/save.
- Adds Rust validation for encrypted vault record-log shape.
- Adds Inspector verification that decrypts the shadow log, replays records, and compares the replay hash with the active vault.
- Keeps the production save path conservative: whole-vault encrypted persistence still remains the authoritative restore path.

## Verification

- `npm test`: 76 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 19 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `B37A6492B2C601CC510A3B8999F1BD09E00EC8031174FF9EC2A99A3BB7B5F143`.

## Security Notes

The new shadow log uses the existing unlocked Vault session key and does not store plaintext record payloads. If shadow persistence fails, the main encrypted vault save still succeeds; the failure is surfaced as a diagnostic instead of risking user data.
