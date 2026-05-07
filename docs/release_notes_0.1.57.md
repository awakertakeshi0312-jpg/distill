# Distill 0.1.57 Release Notes

## What Changed

- Added an in-app A/B sync-folder operation drill.
- The drill simulates source-device export, partner-device bootstrap, partner project/block creation, return packet preview, and source-device dry-run merge.
- The drill verifies encrypted packets do not expose the sync key, project text, or block text as plaintext.
- Added unit coverage for project and block return records in the A/B operation drill.
- Updated sync design, roadmap, and project context docs for the new drill.

## Validation

- `npm test`
- `npm run build`
- `npm run test:e2e`

## Notes

This release still keeps inbound sync apply manual. The operation drill improves confidence before future automatic transport work, but it does not enable automatic inbound apply or cloud sync.