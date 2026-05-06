# Distill 0.1.15 Release Notes

## Summary

Distill 0.1.15 strengthens manual encrypted sync with chained packet checkpoint validation. Known devices now keep the hash of their latest accepted sync packet, and newer packets from that device must continue the known chain.

## Changes

- Adds `packetHash` and `previousPacketHash` to sync packets.
- Stores `lastPacketHash` in known sync device metadata.
- Records the source device checkpoint after exporting an encrypted sync packet.
- Rejects newer sync packets from known devices when the checkpoint chain is disconnected.
- Verifies encrypted sync packet checkpoint hashes after decrypting records.
- Adds UI rejection copy for disconnected sync packets.
- Adds unit coverage for packet hash calculation, source-device checkpoint recording, and disconnected-chain rejection.
- Updates sync, roadmap, project context, and security docs.

## Security Notes

- This is a local hash-chain guard, not a device signature system.
- It improves rollback/disconnected-packet detection before automatic folder or hosted sync is introduced.
- Device removal, trust revocation, and signed/trusted-device verification remain future work.

## Verification

- `npm run check:all`
- `npm run security:audit`
- `npm run release:windows`
- `npm run release:check`
