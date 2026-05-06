# Distill 0.1.12 Release Notes

## Summary

Distill 0.1.12 hardens restore safety and desktop recovery. JSON and encrypted vault restores now show a preview before replacing the current store, and React render failures show recovery guidance instead of leaving the app blank.

## Changes

- Adds restore preview for JSON backup restore.
- Adds restore preview for encrypted vault restore.
- Shows added, updated, removed, and unchanged counts for blocks and projects.
- Shows incoming tombstone and known-device metadata counts before restore.
- Replaces the old immediate restore confirmation with an explicit `Apply restore` action.
- Adds a React error boundary for render failures.
- Adds desktop blank-screen troubleshooting guidance.
- Updates E2E coverage for the preview-before-restore flow.
- Adds unit coverage for restore diff calculation.

## Security Notes

- Restore still replaces the full local store only after the user applies the preview.
- The preview displays counts only, not note content, reducing accidental exposure in the Inspector.
- If WebView cache breaks the installed app before React starts, use the documented cache-rename recovery flow instead of deleting app data.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
