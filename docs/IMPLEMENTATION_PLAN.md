# NEXUS.AI — Implementation Plan

> Companion to `PROJECT_AUDIT.md`. Date: 2026-10-26.
> Principle: extend the existing monorepo, preserve working features and env/deploy config, build incrementally, verify each phase. Never claim a feature works until its full user flow is verified.

---

## Guiding constraints (from the brief)

- Keep the current stack (Next 16 / Express 5 / Mongoose 9 / Clerk / Gemini). No new repo. No microservices.
- Do not overwrite `.env`, `.env.local`, `render.yaml`, or secrets.
- Backward-compatible schema changes only; existing sessions must keep working.
- BYOK preserved. No paid service added without documenting the config requirement.
- Enforce authorization on the backend, not by hiding UI.
- Real data only — no mock candidates/analytics in production flows.

---

## Phase 0 — Guardrails before feature work (small, do first)

Goal: stop the bleeding so later phases are safe and CI is green.

1. **Fix lint errors** (19) — escape entities, swap `<a href="/">`→`next/link`, resolve the `submitAnswer` TDZ hazard in `page.js` timer effect.
2. **Silence/▲ fix Next 16 deprecations** — set `turbopack.root` in `next.config.mjs`; plan the `middleware.js` → `proxy` port (read `node_modules/next/dist/docs/` first per `client/AGENTS.md`).
3. **Add minimal test scaffolding** — a backend test runner (node:test or Vitest) so Phase 2+ business logic can be tested. No feature tests yet.

Verify: `npm run lint` clean, `npm run build` still passes, server modules still `node --check` clean.

**Blocking decision for you:** none. Proceeds automatically.

---

## Phase 1 — Authorization & data isolation (CRITICAL, do before anything that exposes data)

Goal: every protected route verifies the Clerk identity server-side; a user can only touch their own records.

1. Add Clerk backend verification to Express (`@clerk/express` or JWT verification middleware) that resolves the authenticated `userId` from the request, **not** from the URL/body.
2. Rewrite `/interview/user/:clerkId`, `/interview/session/:id`, `DELETE /interview/session/:id`, `/mentor/:clerkId`, `/coach/analyze/:clerkId` to authorize against the verified identity; return 401/403 appropriately.
3. Tighten CORS to an explicit allowlist (keep configured Vercel + localhost origins).
4. Keep BYOK unchanged.

Verify: automated tests for "user A cannot read/delete user B's session" (403), and existing own-data flows still return 200.

**Blocking decision:** confirm Clerk is the single source of identity (it is, per code) and that adding a Clerk **backend** key to `server/.env` is acceptable — this is a new secret and must be documented. I will ask before requiring it.

---

## Phase 2 — Skill intelligence foundation

Goal: a shared, evidence-based candidate skill profile that every later module reads.

1. **Scoring/normalization spec** (documented in `DATA_MODEL.md`): map interview types → skill dimensions (Technical, Coding, Aptitude, Communication, Problem Solving, System Design, HR/Behavioural, Overall Readiness). Define normalization (0–100), confidence/evidence sufficiency, and the "unassessed ≠ 0" rule.
2. **`SkillProfile` model** (new, backward-compatible): per-user, per-dimension score, assessment count, last date, trend history, supporting session refs, confidence, improvement areas.
3. **Recompute on completion**: when a session completes, derive skill evidence from its evaluations and update the profile. Extend `services/session.js` `endSession` (non-breaking).
4. **Backfill** existing sessions into profiles via a safe one-off script (idempotent, reuses `scripts/` pattern).
5. **Make dashboard metrics read the profile** so charts and summaries use consistent aggregation.

Verify: unit tests for normalization + "insufficient evidence"; a completed interview updates the profile; profile endpoint authorized per Phase 1.

---

## Phase 3 — Admin & placement intelligence

Goal: protected recruiter/admin experience over real candidate data.

1. **Roles**: add role to the user model (candidate / interviewer / placement-admin); assignment mechanism documented. Enforce on backend (Phase 1 middleware extended with role checks).
2. **Requirement builder**: `JobRequirement` model + CRUD (`/admin/requirements`) — thresholds per dimension, mandatory vs optional skills, optional min overall readiness, create/edit/duplicate/archive.
3. **Matching engine**: compare requirement vs candidate's latest *sufficiently-supported* profile. Output eligibility (gated by mandatory thresholds) **separately** from a documented match %. Show skill-by-skill pass/fail, missing-evidence, supporting history.
4. **Candidate management + shortlists**: search/filter (paginated), profile breakdown, comparison, shortlist CRUD, exportable reports.
5. **Batch analytics**: real aggregates (registered vs assessed denominators defined), distributions, heatmap, common weaknesses, improvement over time, "meets requirement" counts. Empty states when no data.

Verify: authz boundary tests (candidate blocked from admin APIs by request, not just UI), aggregation correctness tests (no double counting), eligibility-vs-match distinction demonstrated.

---

## Phase 4 — RAG-grounded Nexus Mentor

Goal: ground learning recommendations in retrieved material with source attribution.

1. Inspect current AI architecture; pick the **simplest** compatible retrieval store (likely MongoDB Atlas Vector Search to avoid a new service, or a lightweight local index). Document choice in `RAG_DESIGN.md`.
2. Ingestion: document chunking + metadata + embeddings; updatable knowledge base; access-controlled per-user data.
3. Retrieval flow: weakness (from Phase 2 evidence) + target role → query → ranked passages → LLM → plan/explanation → **show real sources**. No fabricated citations; sensible fallback when retrieval is empty.
4. Guard against prompt injection in retrieved/ingested content.
5. Track learning progress and recommend reassessment; connect back to the skill profile.

Verify: retrieval returns real sources; mentor output cites them; fallback path tested; injection test on a malicious document.

---

## Phase 5 — 3D student digital twin

Goal: interactive 3D avatar wired to real app state and the skill profile.

1. Pick React Three Fiber + GLTF/GLB (compatible with Next 16, lazy-loaded, SSR-off).
2. Build the integration + asset-loading architecture and avatar state machine (idle/listening/speaking/thinking/greeting/in-progress/awaiting-eval/completed) driven by actual interview + voice state.
3. Skill indicators (rings/badges) fed by the Phase 2 profile — never humiliating.
4. Loading state, WebGL/asset fallback (reuse existing 2D `InterviewerAvatar` as graceful fallback), mobile performance.
5. **If a rigged, uniform-correct model is unavailable, deliver the architecture + loading pipeline and document exactly which assets are still required** — do not fake a finished character. (Acropolis uniform spec captured in `AVATAR_INTEGRATION.md`.)

Verify: avatar reacts to speaking/listening; fallback renders when WebGL off; no interview blockage if avatar fails.

**Blocking item:** a licensed/rigged GLB avatar in the Acropolis uniform is an **external asset** I cannot generate. I will build everything around it and list the asset requirement.

---

## Phase 6 — Voice & multilingual improvements

Goal: provider-abstracted, language-consistent voice synced to the avatar.

1. Introduce a TTS/STT **provider abstraction** (ElevenLabs/Deepgram/browser behind one interface) so providers can be swapped.
2. Voice/persona + language selector (English/Hindi/Hinglish; more where the provider supports it); handle unsupported voices/languages explicitly.
3. Keep chosen language consistent across question gen, responses, and speech.
4. Sync avatar speaking/listening with voice; implement lip-sync only if viseme data is available, else document the limitation.

Verify: language consistency end-to-end; graceful handling when a voice/lang is unavailable.

---

## Phase 7 — Integration & production hardening

Goal: prove the full loop and the recruiter loop, then harden.

- End-to-end: Interview → Evaluation → Skill evidence → Profile update → Analytics → Weakness → RAG → Learning → Reassessment → Readiness → Matching; avatar reflects current profile.
- Authz, privacy, DB consistency, pagination, indexes, rate limits on expensive AI/retrieval ops.
- Verify Vercel/Render deploy compatibility unchanged.
- Update root README to reflect **actually implemented** features; finalize all `docs/`.

---

## Dependency ordering rationale

- Phase 1 **must** precede 3/4 (they expose candidate data).
- Phase 2 **must** precede 3/4/5 (skill profile is the shared substrate for matching, RAG targeting, and avatar indicators).
- Phase 0 precedes all (green CI + stable build).
- Phases 5 and 6 are co-dependent (avatar ↔ voice state) and come after the data layers.

---

## Documentation deliverables (per brief §18)

`PROJECT_AUDIT.md` ✅ · `IMPLEMENTATION_PLAN.md` ✅ · `ARCHITECTURE.md` (stub) · `DATA_MODEL.md` (stub) · `API_REFERENCE.md` (stub) · `RAG_DESIGN.md` (stub) · `AVATAR_INTEGRATION.md` (stub) · `ADMIN_PLACEMENT_INTELLIGENCE.md` (stub) · README update (pending Phase 7).

Stubs are created now as living documents and filled in as each phase lands. Each will tag items as: Implemented & verified / Implemented, unverified / Partial / Planned or blocked.

---

## Open questions for you (will ask at the relevant phase, not now)

1. **Clerk backend key** in `server/.env` for server-side auth (Phase 1) — OK to add this new secret?
2. **Coding execution** (Phase relabel / later sandbox): acceptable to relabel coding feedback as "LLM review, not executed" now, and add a real sandbox (Judge0 or container) later?
3. **Role assignment**: how should the first placement-admin be created (seed script? manual DB flag? Clerk metadata)?
4. **RAG store**: preference between MongoDB Atlas Vector Search (no new service) vs a dedicated vector DB?
5. **Avatar asset**: can you supply a rigged GLB in the Acropolis uniform, or should I integrate a placeholder rigged model and document the swap?

None of these block Phase 0. I will proceed with Phase 0 next unless you redirect.
