# Distill 0.1.5 Release Notes

## Summary

Distill 0.1.5 packages the update diagnostics added after the 0.1.4 updater validation. The app now makes the installed version, runtime, and release feed visible from the Inspector update section.

## Changes

- Show `Distill v0.1.5` in the sidebar.
- Add update diagnostics in the Inspector:
  - current app version
  - desktop/browser runtime
  - configured release feed URL
  - latest GitHub release page link
- Keep release folders, build outputs, and test artifacts out of Git.

## Verification

- Run `npm test`.
- Run `npm run build`.
- Run `npm run test:e2e`.
- Build signed Windows updater artifacts with `npm run release:windows`.

## Manual Release Assets

Upload these files to the GitHub release:

- `release/Distill_0.1.5_x64-setup.exe`
- `release/Distill_0.1.5_x64-setup.exe.sig`
- `release/latest.json`
