# Distill 0.1.41 Release Notes

## Summary

Distill 0.1.41 adds a sync preview rollback drill so risky sync previews can be checked before apply without changing the active vault.

## Changes

- Adds a pure rollback drill helper that snapshots the current store, dry-runs incoming sync packet apply, and builds the restore path back to the pre-sync snapshot.
- Adds a `Run rollback drill` action inside the sync preview panel.
- Confirms the active vault is unchanged after the dry run.
- Reports how many block changes would be reverted by the rollback path.
- Adds unit coverage for the dry-run rollback result and store immutability.

## Verification

- `npm test`: 71 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `git diff --check`: passing.
- `npm run release:windows`: signed Windows installer generated.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `E9C75F4E2440E524D7616E752470264EDA9DB64F441E16FAD06D2A2C1A756496`.

## Security Notes

This is a pre-transport safety feature. It does not enable automatic inbound sync. It gives the user a dry-run proof that the current preview can be rolled back to the pre-sync snapshot before manual apply.
