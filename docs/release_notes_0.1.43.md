# Distill 0.1.43 Release Notes

## Summary

Distill 0.1.43 adds the encrypted vault record-log foundation needed to move from whole-vault persistence toward record-level encrypted persistence and future safer sync compaction.

## Changes

- Adds `vaultRecordLog.ts`, a pure storage-boundary module that converts the current store into encrypted per-record payloads.
- Supports record entries for projects, thought blocks, deletion tombstones, known sync devices, revoked sync devices, and dedicated sync-key material.
- Adds replay support that decrypts record payloads, verifies payload hashes, validates payload shape, and reconstructs a normalized `DistillStore`.
- Keeps the active production save path unchanged: normal saves still use the stable whole-vault encrypted envelope.
- Adds Inspector copy that exposes the record-log foundation status without implying automatic sync/apply is enabled.
- Updates storage boundary and roadmap documentation to separate "foundation implemented" from "active normal persistence migration not yet enabled."

## Verification

- `npm test`: 75 passed.
- `npm run build`: passing.
- `npm run test:e2e`: 11 passed.
- `npm run test:rust`: 18 passed.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run release:check`: passed after manifest generation.
- Release artifact SHA256: `BB60F7E1994C225D0D6EA34FFE2E1A8B8A7174BD49224F78765E62172823AFA6`.

## Security Notes

This release does not turn on automatic inbound sync or replace the active local whole-vault save path. The new record log keeps record payloads encrypted and only leaves bounded metadata visible, matching the current sync-packet privacy boundary.
