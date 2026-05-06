# Distill AI Org Event Bridge

Date: 2026-05-06

## Purpose

Distill sends summary-only coordination records to the central AI Org Kernel. It must not emit private note bodies, vault contents, secrets, or raw exports by default.

Central Kernel:

```text
C:\Users\awake\dev\active\ai-org-kernel
```

## Commands

Emit a decision event:

```powershell
npm run org:decision -- --summary "Adopt summary-only AI Org event bridge"
```

Emit a decision with an artifact reference:

```powershell
npm run org:decision -- --summary "Daily review format accepted" --path docs\review-format.md
```

Register an artifact and emit `artifact.ready`:

```powershell
npm run org:ready -- --title "Distill event bridge" --path docs\ai_org_event_bridge.md --type project_doc --summary "Summary-only bridge from Distill to AI Org Kernel."
```

Dry run:

```powershell
npm run org:decision -- --summary "Dry run decision" --dry-run
npm run org:ready -- --title "Dry run artifact" --path docs\ai_org_event_bridge.md --dry-run
```

## Local API Escape Hatch

The default destination is the central file-based Kernel. Use `--local-api` only when intentionally testing the Personal KM local API:

```powershell
npm run org:event -- --local-api --type decision.created --summary "Local API test"
npm run org:artifact -- --local-api --title "Local API artifact" --path docs\ai_org_event_bridge.md --summary "Local API test"
```

## Privacy Contract

Allowed by default:

- decision summaries
- artifact paths
- tags or categories
- high-level review status
- work packet IDs

Not allowed by default:

- private note body text
- vault payloads
- passphrases or secrets
- full export files as payloads
- user identity data beyond local project metadata

## Work Packet

This satisfies the current central Work Packet:

```text
wp_20260506_connect-distill-decision-and-artifact-events_57cf3bda
```

Completion evidence:

- `decision.created` can be emitted with `npm run org:decision`.
- `artifact.ready` can be emitted with `npm run org:ready`.
- payloads are summary-only unless the user explicitly attaches a safe artifact path.

## App Event Hooks

The desktop app also emits summary-only events through the Tauri command `emit_ai_org_event`.

Current hooks:

- capture saved -> `memory.save_requested`
- review item marked processed -> `decision.created`
- Markdown/JSON/backup export generated -> `artifact.ready`

The hook module is:

```text
src\aiOrg.ts
```

It sends block IDs, note IDs, state, counts, and project IDs only. It does not send note body text, vault payloads, export contents, passphrases, or secrets.
