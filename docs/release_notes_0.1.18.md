# Distill 0.1.18 Release Notes

## Summary

Distill 0.1.18 adds the first safety gate required before automatic sync. Risky encrypted sync packets now require an explicit review checkbox before applying, and suspicious or unwanted folder packets can be moved into a local quarantine folder so they stop appearing in normal sync scans.

## Changes

- Adds a Tauri command to quarantine selected encrypted sync packet files.
- Moves quarantined packet files into `.distill-quarantine` inside the selected sync folder.
- Keeps quarantined packet files out of normal sync-folder scans.
- Adds a quarantine action beside each sync-folder packet in the Inspector.
- Adds a risk confirmation gate for sync previews that would update/delete local data or rely on same-time tie-breaks.
- Adds UI copy and styling for the sync risk gate.
- Adds Rust coverage for sync packet quarantine behavior.

## Security Notes

- Quarantine is local file isolation, not cryptographic revocation.
- The user still explicitly chooses whether to preview, quarantine, or apply packets.
- Automatic/background sync remains disabled until conflict handling and transport safety are stronger.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
