# Distill 0.1.13 Release Notes

## Summary

Distill 0.1.13 adds a summary-only Personal KM handoff path and hardens trust boundaries around encrypted vaults and manual sync packets.

## Changes

- Adds a Personal KM handoff action in the Inspector.
- Adds `npm run org:handoff` to generate summary-only handoff JSON and Markdown.
- Sends processed Distill blocks to Personal KM as metadata-only review records.
- Extends AI Org artifact events for Personal KM handoff.
- Adds encrypted vault tamper/corruption tests.
- Adds stale sync packet rejection based on source device `lastPacketAt`.
- Documents the Personal KM handoff privacy contract.
- Updates sync, vault, roadmap, security, and project context docs.

## Security Notes

- Personal KM handoff intentionally omits note bodies, vault payloads, exports, passphrases, tokens, credentials, and secrets.
- Handoff records include IDs, note IDs, project IDs, counts, timestamps, tags, and summary-only markers.
- Manual sync now skips older or already imported packets from a known source device.
- Stronger chained sync checkpoint validation remains future work.

## Verification

- `node --check scripts/export-personal-km-handoff.js`
- `npm run org:handoff`
- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
