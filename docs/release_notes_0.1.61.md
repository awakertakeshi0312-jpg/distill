# Distill 0.1.61 Release Notes

## What Changed

- Added AI Secretary as a companion app in the Distill navigation.
- Added URL handoff support for AI Secretary integration.
- Distill now detects `?handoff=...#inbox`, shows a review banner after vault unlock, and imports the handoff into the encrypted vault only after confirmation.
- Added E2E coverage for AI Secretary handoff import.
- Documented the cross-app UI integration boundary.

## Validation

- `npm test`
- `npm run build`
- `npm run test:e2e`
