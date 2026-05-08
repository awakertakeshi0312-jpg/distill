# Distill 0.1.58 Release Notes

## What Changed

- Added a Daily journal input lane beside the existing thought capture lane.
- Journal entries save as normal Distill blocks so they appear in Today, Search, Graph, export, sync, and backup flows.
- Journal entries automatically include `#journal` and `[[Daily Journal]]` for rediscovery and graph context.
- The capture layout stays two-column on desktop and stacks cleanly on mobile.
- Added E2E coverage for saving a journal entry from the capture area.

## Validation

- `npm test`
- `npm run build`
- `npm run test:e2e`

## Notes

This is intentionally a lightweight journal lane, not a separate data model. Keeping entries as normal blocks preserves current encryption, sync, export, search, and restore behavior.