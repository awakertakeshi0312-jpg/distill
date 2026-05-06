# Distill 0.1.19 Release Notes

## Summary

Distill 0.1.19 adds a safer semi-automatic scan for desktop sync folders. Before a user previews or applies a packet, Distill can decrypt each candidate with the current vault passphrase and classify it as ready, risk review required, stale, blocked, checkpoint risk, or invalid.

## Changes

- Adds a sync-folder safety scan button in the Inspector.
- Reviews every folder packet against the unlocked local vault before import.
- Classifies packets from revoked devices as blocked.
- Classifies disconnected checkpoint-chain packets as checkpoint risk.
- Classifies stale or already imported packets separately from actionable packets.
- Marks packets that would update/delete local records or rely on same-time tie-breaks as risk review.
- Blocks preview for invalid, revoked-source, and checkpoint-risk packets while keeping quarantine available.
- Adds packet-level status badges and review details in the sync-folder list.

## Security Notes

- The scan is local and uses the current in-memory vault passphrase; no plaintext sync content is written to disk.
- The scan does not auto-apply packets. The user still previews and explicitly applies safe/risky packets.
- Automatic/background sync remains disabled until transport recovery and conflict behavior are hardened further.

## Verification

- `npm test`
- `npm run build`
- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
