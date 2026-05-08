# Distill 0.1.60 Release Notes

## What Changed

- Added the verified public mobile web URL to the Mobile access panel.
- Centralized the public web URL in `src/appInfo.ts`.
- Added E2E coverage so the Mobile panel must expose the GitHub Pages PWA URL.
- Updated the mobile strategy document with the verified public URL status.

## Mobile URL

```text
https://awakertakeshi0312-jpg.github.io/distill/
```

## Validation

- `npm test`
- `npm run build`
- `npm run test:e2e`
