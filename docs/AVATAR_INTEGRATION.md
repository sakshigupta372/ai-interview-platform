# NEXUS.AI — 3D Digital Twin (Avatar) Integration

> Living document. Date: 2026-10-26. **Status: [Planned] — not yet implemented.**

## Current state — [Verified]
`client/components/InterviewerAvatar.js` is a **2D** CSS/Framer-Motion circle with persona initials and sound-wave bars. There is **no 3D model** in the project. This 2D component is a good graceful fallback for the planned 3D layer.

## Target — [Planned]
Interactive 3D student twin representing the candidate.

### Visual spec (Acropolis Institute of Technology and Research uniform)
- Dark navy formal blazer + trousers
- Light blue shirt
- Navy tie with red diagonal stripes
- College emblem on blazer pocket
- Purple Acropolis lanyard + identity card
- Black formal shoes
- Read as a **college student**, not corporate adult or schoolchild. Setting: modern Indian engineering campus / interview room.

### Tech (planned)
- React Three Fiber + drei, GLTF/GLB assets, lazy-loaded (SSR off), optimized for web + mobile.
- Avatar state machine: idle, listening, speaking, thinking, greeting, interview-in-progress, awaiting-evaluation, completed — driven by **actual** interview + voice state.
- Skill indicators (rings/badges) fed by the Phase 2 `SkillProfile`. Never humiliating for low scores.
- Loading state; WebGL/asset-missing fallback to the existing 2D avatar; must never block the interview.

## Blocked asset requirement — [Blocked]
A **rigged GLB/GLTF character in the Acropolis uniform with the listed animation clips** is an external art asset that cannot be code-generated here. Plan: build the full loader + state-machine + indicator integration against a placeholder rigged model, and document the exact asset spec needed to swap in the real one. The integration will be real; the final character art is the blocked piece.

## Status summary
Architecture/plan only. No 3D code or assets exist yet.
