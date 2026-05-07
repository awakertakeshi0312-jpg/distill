# Distill 0.1.31 Release Notes

## Summary

Distill 0.1.31 adds safe semi-automatic inbound sync preview for the desktop sync folder.

## Changes

- Adds a safe inbound preview toggle for sync-folder monitoring.
- Automatically opens a sync preview only when exactly one known-device ready packet is available.
- Keeps sync apply fully manual; no incoming packet is applied automatically.
- Skips auto-preview when another preview is already open.
- Avoids reopening the same packet candidate using a path/modified-time/size key.
- Adds regression coverage for safe auto-preview decisions.

## Verification

- `npm test`: 55 passed.
- `npm run build`: passing.
- Release artifact SHA256: `411D9DB99C66F28C111A2C5EF98E431E6CF17A58949EC3DCEAB1182703E37415`.

## Security Notes

This is intentionally preview-only automation. It reduces manual review friction without crossing the main safety boundary: applying an inbound sync packet still requires explicit user action and existing risk/trust gates.
