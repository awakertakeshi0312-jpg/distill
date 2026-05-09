# Distill and AI Secretary UI Integration

## Direction

Distill and AI Secretary should feel like one personal operating system while keeping their responsibilities separate:

- Distill owns private thought capture, encrypted vault storage, search, links, graph, and knowledge maturation.
- AI Secretary owns schedule, tasks, chat, approvals, execution review, and mobile public operations.

## Current Integration

- Distill exposes a companion link to AI Secretary in the primary navigation.
- AI Secretary exposes a companion link to the public Distill PWA URL.
- AI Secretary already prepares Distill handoff packages and Distill decision returns.
- AI Secretary can open Distill with a signed-shape URL handoff payload in `?handoff=...#inbox`.
- Distill detects the incoming handoff after vault unlock, shows a review banner, and imports it into the encrypted vault only after the user confirms.
- Distill also accepts the same handoff shape through a local `postMessage` sync protocol. When the vault is unlocked and AI Secretary sends `autoImport: true`, Distill imports the handoff with a duplicate marker and returns an ack.
- Distill returns a summary snapshot and processed AI Secretary-related decisions through `distill.sync.snapshot`.
- AI Secretary can send a session-only `ai-secretary.sync.unlock` request. Distill uses that passphrase only to open the current vault session; it does not store the passphrase.
- AI Secretary can request `distill.sync.vault-export`. Distill returns only the encrypted vault export; plain in-memory store data is never sent through the shell sync protocol.

## URLs

- Distill PWA: `https://awakertakeshi0312-jpg.github.io/distill/`
- AI Secretary: `https://ai-secretary.takeshi-notes.com/`

## Next UI Phases

1. Shared top-level command center card in both apps.
2. Distill decision return panel that AI Secretary can consume without manual JSON paste. Implemented for the unified shell through `postMessage` snapshots.
3. Shared design tokens for typography, spacing, status badges, and mobile navigation.
4. Optional unified shell after data ownership and auth boundaries are stable. Implemented in AI Secretary as the `shell` tab with Distill embedded.

## Boundary

Do not silently merge encrypted Distill vault data into AI Secretary. UI integration should use explicit handoff packets, links, bounded summary snapshots, and encrypted-only vault export requests until E2EE sync is implemented. The unified shell can unlock the embedded Distill session only from a passphrase entered for that browser session.
