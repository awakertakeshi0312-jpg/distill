# Distill 0.1.48 Release Notes

## Summary

Distill 0.1.48 fixes an unlock compatibility issue: the existing-vault unlock form no longer enforces the 12-character HTML minimum before attempting decryption.

## Changes

- Keeps the 12-character minimum for creating a new vault.
- Removes the browser `minLength` constraint when unlocking an already-created vault.
- Adds an E2E regression test that confirms existing-vault unlock does not block short legacy passphrases at the form layer.

## Verification

- `npm test`: 78 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 12 passed.
- `npm run test:rust`: 20 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:check`: passed.
- Release artifact SHA256: `0D0FAE4F338C1837CB7E9AA421BA4336C3D9421F9FB4EBFF9BA5A973DE2C30E2`.

## Security Notes

This does not weaken vault encryption. The passphrase is still verified only by AES-GCM decryption with the stored PBKDF2 metadata. The change only prevents the browser form from rejecting an existing passphrase before the decrypt routine can evaluate it.
