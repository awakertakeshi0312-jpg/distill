# Distill 0.1.32 Release Notes

## Summary

Distill 0.1.32 hardens the mobile/PWA path so the app is easier to install from a phone browser and less likely to keep stale app-shell HTML after updates.

## Changes

- Adds a Mobile / PWA readiness panel in the Inspector.
- Shows platform, offline-shell support, network state, and install/home-screen guidance.
- Captures the browser install prompt when available and exposes a local install action.
- Adds PWA app metadata, mobile web app meta tags, and a PNG touch icon for home-screen installs.
- Changes the service worker to use network-first navigation with offline fallback, reducing stale mobile shell risk after releases.
- Adds regression coverage for PWA install guidance decisions.
- Adds a phone-width E2E smoke test for the PWA readiness panel.

## Verification

- `npm test`: 58 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- Release artifact SHA256: `F55706D8873DE33887F383C7F8EE233EE2BE28AA4FDB97EEE11DB454BAF375D0`.

## Security Notes

The PWA path remains local-first and this-device-only. Browser/PWA storage still uses an encrypted localStorage envelope, so production mobile sync should wait for stronger mobile persistence and E2EE sync transport.
