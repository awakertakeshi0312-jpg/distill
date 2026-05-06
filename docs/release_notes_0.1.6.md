# Distill 0.1.6 Release Notes

## Summary

Distill 0.1.6 focuses on security hardening and smartphone readiness.

## Changes

- Enables Tauri CSP instead of leaving CSP disabled.
- Adds an explicit Tauri custom command allow-list.
- Adds generated Tauri command permissions to the desktop capability.
- Limits the updater capability to desktop platforms.
- Tightens manual update installer filename validation.
- Adds PWA metadata, icon, and service worker.
- Adds mobile bottom navigation and smaller-screen layout refinements.
- Adds GitHub Pages deployment workflow for a mobile web preview.
- Adds security assessment and mobile strategy documentation.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run tauri:build:windows`
