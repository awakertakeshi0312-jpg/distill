# Distill 0.1.38 Release Notes

## Summary

Distill 0.1.38 adds visible lifecycle controls for dedicated sync keys and fixes first-export persistence of newly created sync key material.

## Changes

- Adds a Sync key card to the Inspector sync section.
- Shows whether a dedicated sync key is active, its key id, and its creation timestamp.
- Adds a manual create action for vaults that do not have dedicated sync key material yet.
- Adds a rotate action for future sync packets, with confirmation and recovery warning copy.
- Ensures the sync key created during the first encrypted sync export is persisted back into the encrypted vault.
- Resets sync-folder auto-export fingerprints after key rotation so the next outbound packet uses the new key.
- Adds regression coverage for create/reuse/rotate lifecycle behavior.

## Verification

- `npm test`: 68 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `E3E99F019FDD9DC78AA0FF8CE99CC6BF9D7B850EDAAE65F262E63CDC518C2083`.

## Security Notes

Rotation affects future packets only. Older packets remain readable through their wrapped sync key and the vault passphrase. Automatic inbound apply remains disabled; sync import still requires preview, device trust checks, and explicit apply.
