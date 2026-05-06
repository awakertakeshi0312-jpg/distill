# Distill 0.1.17 Release Notes

## Summary

Distill 0.1.17 publishes the first sync decision-review layer. Manual encrypted sync previews now explain not only what will be added, updated, skipped, or deleted, but also which side wins and how many local records are affected before the user applies a packet.

## Changes

- Adds sync preview decision counts for remote wins.
- Adds sync preview decision counts for local wins.
- Adds same-time tie-break counts for deterministic conflict decisions.
- Adds local changes/deletes counts so destructive sync effects are visible before applying.
- Shows the decision-review section in English and Japanese.
- Updates roadmap, sync design, and project context for the next sync-hardening phase.

## Security Notes

- Sync packet import remains explicit and user-triggered.
- The app still decrypts sync records only in memory after vault unlock.
- The new decision review does not enable automatic sync; it prepares safer user review before automatic transport is added.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
