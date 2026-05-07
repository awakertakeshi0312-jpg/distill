# Distill Project Context

## Current Status (2026-05-07)

- Current version: 0.1.30.
- Current phase: Trust Layer / Phase 6 Sync hardening.
- Current completion estimate: 75% overall; this phase advanced +2pt in this pass.
- Implemented in this pass: known-device forget/removal UI for the sync device registry. Distill can now remove a known non-current device without revoking it, preserving tombstones/revocations while forcing future packets from that device through trust verification again.
- Sync-folder packet statuses: ready, risk review, stale, blocked, checkpoint risk, invalid. Monitoring and outbound auto-export never auto-apply incoming packets; sync apply is now gated by signature verification for trusted devices, source-device verification code confirmation when needed, local risk acknowledgement for destructive decisions, and a local encrypted recovery snapshot.
- Still not implemented: automatic inbound sync/apply, mobile-native app, hosted E2EE sync, real vector search, Windows code-signing certificate, polished mobile-native pairing flow, and richer multi-device lifecycle management beyond local revoke/forget.
- Primary docs: `docs/project_context.md`, `docs/roadmap.md`, `docs/sync_design.md`, `docs/release_notes_0.1.30.md`.
## 蠖ｹ蜑ｲ

諤晁・・譁ｭ迚・ｒ謐輔∪縺医√ち繧ｰ繝ｻ繝ｪ繝ｳ繧ｯ繝ｻ讀懃ｴ｢繝ｻ繧ｰ繝ｩ繝輔・繝ｬ繝薙Η繝ｼ繧帝壹§縺ｦ縲∝愛譁ｭ繧・衍隴倥↓闥ｸ逡吶☆繧九Ο繝ｼ繧ｫ繝ｫ繝輔ぃ繝ｼ繧ｹ繝医・繝・せ繧ｯ繝医ャ繝励い繝励Μ縲・
## 迴ｾ蝨ｨ縺ｮ迥ｶ諷・
- 迴ｾ蝨ｨ縺ｮ蜈ｬ髢狗沿縺ｯ `0.1.11`縲・- Project ID 縺ｯ `distill`縲、I Org 荳翫・蠖ｹ蜑ｲ縺ｯ Thinking Core縲・- Kernel API 縺ｯ `http://localhost:3001/api/org`縲・- React + TypeScript + Vite + Tauri縲・- 繝悶Λ繧ｦ繧ｶ髢狗匱繝昴・繝医・ `4173`縲・- encrypted local vault gate縲√ヱ繧ｹ繝輔Ξ繝ｼ繧ｺ螟画峩縲∬・蜍輔Ο繝・け縲√Ο繝ｼ繧ｫ繝ｫ菫晏ｭ倥ｒ謖√▽縲・- 謇句虚縺ｮ證怜捷蛹穆ync packet export/import縲∫ｫｯ譛ｫID縲∫ｫｯ譛ｫ繝ｬ繧ｸ繧ｹ繝医Μ縲∝炎髯､tombstone繧呈戟縺､縲・- Inbox縲ゝoday縲ヾearch縲；raph縲￣rojects縲、rchive縲・xport/Import縲∬ｨ隱槫・譖ｿ繧貞ｮ溯｣・ｸ医∩縲・- MVP 縺ｯ Windows 縺ｧ buildable縲・
## 襍ｷ蜍輔さ繝槭Φ繝・
```powershell
cd C:\Users\awake\dev\active\distill
npm run dev
```

Tauri 髢狗匱:

```powershell
npm run tauri:dev:windows
```

## 繝・せ繝医さ繝槭Φ繝・
```powershell
npm test
npm run build
npm run test:rust
npm run test:e2e
```

## 螢翫＠縺ｦ縺ｯ縺・￠縺ｪ縺・｢・阜

- 證怜捷蛹・vault縲√ヰ繝・け繧｢繝・・縲∝ｾｩ蜈・・莠呈鋤諤ｧ繧貞｣翫＆縺ｪ縺・・- Tauri capability 繧剃ｸ崎ｦ√↓蠎・￡縺ｪ縺・・- 繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ繝ｭ繝ｼ繧ｫ繝ｫ諤晁・ョ繝ｼ繧ｿ繧貞､夜Κ騾∽ｿ｡縺励↑縺・・- 繝ｪ繝ｪ繝ｼ繧ｹ鄂ｲ蜷阪・繧｢繝・・繝・・繧ｿ蟆守ｷ壹ｒ荳咲畑諢上↓螟画峩縺励↑縺・・
## 螳梧・蛻､螳・
- `npm run build` 縺梧・蜉溘☆繧九・- `npm test` 縺梧・蜉溘☆繧九・- `npm run test:rust` 縺梧・蜉溘☆繧九・- `npm run test:e2e` 縺梧・蜉溘☆繧九・- vault unlock縲…apture縲《earch縲‘xport/import 縺ｮ荳ｻ隕∝ｰ守ｷ壹′邯ｭ謖√＆繧後ｋ縲・- 蛻､譁ｭ繧・・譫懃黄繧・`decision.created` / `artifact.ready` 縺ｨ縺励※ AI Org 縺ｫ騾√ｌ繧九・