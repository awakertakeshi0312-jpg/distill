# Distill to Personal KM Handoff

Generated: 2026-05-06T08:58:57.347Z

## Purpose

This file is a summary-only handoff manifest for moving reviewed Distill decisions and ready artifacts into Personal KM without copying private note bodies.

## Personal KM Target

Preferred ingestion target:

```text
POST /api/review
```

Review item body should contain only the handoff summary and source reference. Raw Distill note content, vault payloads, exports, passphrases, secrets, and credential values must not be copied.

Machine-readable fallback file:

```text
docs/distill_personal_km_handoff.json
```

## Privacy Boundary

Mode: `summary_only_no_note_body`

The exporter drops private-looking keys and keeps only scalar summary metadata. Record IDs, counts, states, tags, artifact types, and AI Org source references are allowed.

## Records

| ID | Kind | Source | Title |
| --- | --- | --- | --- |
| `distill_event_c5f189534771` | ready_artifact | `ai-org://event/evt_20260506084227345_04b29052` | Distill Personal KM handoff |
| `distill_event_350150ea0ba5` | ready_artifact | `ai-org://event/evt_20260506083907505_c0434512` | Distill Personal KM handoff exporter |
| `distill_event_175636667543` | ready_artifact | `ai-org://event/evt_20260506083907471_a8988864` | Distill to Personal KM handoff manifest |
| `distill_event_3fecc6490c1b` | ready_artifact | `ai-org://event/evt_20260506083907346_477f61a4` | Distill to Personal KM handoff contract |
| `distill_event_8fb20d21c63c` | ready_artifact | `ai-org://event/evt_20260506080024325_501dda69` | Distill AI Org integration |
| `distill_event_d7127d5ffe2a` | reviewed_decision | `ai-org://event/evt_20260506080024229_630c3d31` | M5 bridge verified: Distill can emit decision events |
| `distill_event_fa5dac213a54` | ready_artifact | `ai-org://event/evt_20260506073625502_c5e3b759` | Distill 0.1.11 release manifest |
| `distill_event_e37fb8714a0d` | reviewed_decision | `ai-org://event/evt_20260506073625477_9df2ad27` | Ship Distill 0.1.11 sync tombstones and summary-only app events |
| `distill_event_e64b9f9b232d` | ready_artifact | `ai-org://event/evt_20260506071828700_d472220c` | Distill real app AI Org event hooks |
| `distill_event_5c6aba29f095` | reviewed_decision | `ai-org://event/evt_20260506071413468_54f01902` | Distill app event hooks remain summary-only by default |
| `distill_event_272ddcbea146` | ready_artifact | `ai-org://event/evt_20260506071413447_3fec8479` | Distill real app event hooks |
| `distill_event_b0e3dd4a04cf` | ready_artifact | `ai-org://event/evt_20260506065553882_60cbd157` | Distill build health restored |
| `distill_event_c4dbdad5b939` | ready_artifact | `ai-org://event/evt_20260506063410759_c3badbc8` | Distill 0.1.10 release manifest |
| `distill_event_640b39fb6e56` | reviewed_decision | `ai-org://event/evt_20260506063410530_b9e7243f` | Ship Distill 0.1.10 with manual encrypted sync packet UI |
| `distill_event_7f53d6923276` | ready_artifact | `ai-org://event/evt_20260506062011806_014871bb` | Distill AI Org event bridge |
| `distill_event_58469c5e9fdc` | reviewed_decision | `ai-org://event/evt_20260506062011799_da8ee37f` | Distill summary-only AI Org bridge adopted |
| `distill_event_52d8a62f8c62` | ready_artifact | `ai-org://event/evt_20260506053706891_adca6f7f` | AI Org Kernel integration files installed |
| `distill_artifact_2fc43a2d6394` | registered_artifact | `ai-org://artifact/art_20260506_a43b24f2` | Distill Personal KM handoff |
| `distill_artifact_92bb324a90ac` | registered_artifact | `ai-org://artifact/art_20260506_90d2c502` | Distill Personal KM handoff exporter |
| `distill_artifact_ddde0af96182` | registered_artifact | `ai-org://artifact/art_20260506_6d07eb39` | Distill to Personal KM handoff manifest |
| `distill_artifact_396879e1785a` | registered_artifact | `ai-org://artifact/art_20260506_02d434e0` | Distill to Personal KM handoff contract |
| `distill_artifact_ddeb077d0663` | registered_artifact | `ai-org://artifact/art_20260506_b004fa27` | Distill AI Org integration |
| `distill_artifact_92afe6bdc1b3` | registered_artifact | `ai-org://artifact/art_20260506_19b1d972` | Distill 0.1.11 release manifest |
| `distill_artifact_6bcbf88f664b` | registered_artifact | `ai-org://artifact/art_20260506_e949cbac` | Distill real app AI Org event hooks |
| `distill_artifact_cee0ece2591a` | registered_artifact | `ai-org://artifact/art_20260506_f47ce508` | Distill real app event hooks |
| `distill_artifact_0231a6a1df24` | registered_artifact | `ai-org://artifact/art_20260506_fb7827fc` | Distill build health restored |
| `distill_artifact_58199bcf3434` | registered_artifact | `ai-org://artifact/art_20260506_be17fd6e` | Distill 0.1.10 release manifest |
| `distill_artifact_50d81c99df54` | registered_artifact | `ai-org://artifact/art_20260506_a3fe55a5` | Distill AI Org event bridge |

## Verification

```powershell
node --check scripts/export-personal-km-handoff.js
npm run org:handoff
npm test
npm run build
```

Associated Work Packet:

```text
wp_20260506_connect-distill-reviewed-artifacts-to-personal-km
```
