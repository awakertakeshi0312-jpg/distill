# Distill 0.1.56 Release Notes

## Summary

This release advances the sync hardening phase by adding encrypted project metadata records to Distill sync packets.

## Changes

- Added `project` records to the record-level sync packet model.
- Encrypted project records with the same packet-level sync session path used for block and tombstone records.
- Added project add/update/skip counts to sync preview.
- Included project metadata in sync-folder auto-export fingerprints so project changes can trigger outbound packets.
- Preserved legacy encrypted packet decryption behavior.

## Verification

- `npm test`: 80 passed.
- `npm run build`: passed.
- `npm run test:e2e`: 14 passed.
