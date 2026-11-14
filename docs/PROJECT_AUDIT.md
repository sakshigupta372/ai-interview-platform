# NEXUS.AI — Project Audit

> Status date: 2026-10-26
> Auditor: senior full-stack / AI engineer review
> Method: full read of source, dependency inspection, `git status`, client `lint`, client `build`, server syntax check. No code was modified during the audit.

This document records **verified facts** about the repository as it exists today. Each claim notes how it was confirmed. Where the README and the code disagree, the code wins and the gap is called out.

---

## 1. Verification performed

| Check | Command | Result |
|---|---|---|
| Node / npm | `node -v`, `npm -v` | Node v22.18.0, npm 10.9.3 |
| Client deps installed | `Test-Path client/node_modules` | True |
| Server deps installed | `Test-Path server/node_modules` | True |
| Client lint | `npm run lint` (in `client`) | **FAIL — 19 errors, 3 warnings** |
| Client production build | `npm run build` (in `client`) | **PASS** (with deprecation warnings) |
| Server module syntax | `node --check` on all server modules | PASS |
| Git working tree | `git status --short` | Clean except untracked `bench.py`, `bench_results.json`, `scripts/` |
| Env secrets tracked? | `git ls-files server/.env client/.env.local` | Not tracked (correctly gitignored) |

> The server was **not** booted against a live MongoDB/Gemini during the audit (no throwaway credentials available). Syntax and data-flow were verified by reading; runtime behavior against live services is **unverified**.

---

## 2. Repository shape

Monorepo, two independent apps plus tooling:

```
/                 root — concurrently runs both apps (dev), installs server (build)
├── client/       Next.js 16.2.1 App Router frontend (deploys to Vercel)
├── server/       Express 5 + Mongoose 9 backend (deploys to Render)
├── scripts/      measure_db.js — read-only DB metrics (untracked)
├── bench.py      latency benchmark harness (untracked)
├── render.yaml   Render service definition
└── docs/         (this audit set)
```

- Branch: `main`. Recent commits show active, incremental feature work (coach UI, Hindi/Hinglish TTS, 60+ company search, hero landing page).
- `bench.py`, `bench_results.json`, `scripts/` are **untracked local work** — preserved, not modified.

---

## 3. Actual tech stack (confirmed in code)

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | Next.js **16.2.1** (App Router, Turbopack), React 19.2 | `client/package.json`, build output |
| Styling | Tailwind CSS v4 + heavy inline styles | `client/package.json`, page files |
| Auth | Clerk (`@clerk/nextjs` ^7) | `layout.js`, `middleware.js` |
| AI | Google Gemini `gemini-2.5-flash` via `@google/genai` | all `server/ai/*.js` |
| Code editor | Monaco (`@monaco-editor/react`), lazy-loaded | `components/CodeEditor.js` |
| Charts | Recharts | `profile/page.js` |
| PDF export | jsPDF (client-side) | `mentor/page.js` (roadmap export); report export referenced in `page.js` |
| TTS | **ElevenLabs** API + browser `speechSynthesis` fallback | `lib/tts.js` |
| STT | **Deepgram** WebSocket (`nova-2`) + browser fallback | `lib/deepgramSTT.js` |
| Backend | Node ≥18, Express **5**, Mongoose **9** | `server/package.json` |
| File parsing | Multer (memory storage) + pdf-parse | `routes/resume.js` |
| DB | MongoDB (Atlas in prod) | `db.js` |
| Deploy | Vercel (client) + Render (server) + MongoDB Atlas | `render.yaml`, `DEPLOY-RENDER.md` |

**README drift:** README lists voice as "Web Speech API" only and omits ElevenLabs/Deepgram. README does not mention the `/coach` route/agent or the `Roadmap` model. Company list in code is 60+, not the "Google/Amazon/Stripe" described. Multi-language (English/Hindi/Hinglish) exists in code but is under-documented.

---

## 4. Architecture & data flow (as built)

```
Browser (Next.js, Vercel)
  → Clerk auth (components gate UI; homepage public)
  → BYOK: user's Gemini key kept in sessionStorage only
  → optional resume PDF → POST /resume/parse
  → SSE + axios to Express
Express (Render)
  ├─ /interview  stream-start (SSE)  → create session + stream opening question
  │              evaluate            → score answer, persist, adapt difficulty
  │              stream-next (SSE)   → stream adaptive follow-up
  │              answer (legacy)     → non-streaming combined path
  │              session CRUD        → get / list-by-user / delete
  ├─ /resume/parse   → pdf-parse → Gemini → structured profile JSON
  ├─ /mentor         → GET profile (aggregates) ; POST generate (roadmap, cached)
  └─ /coach/analyze  → aggregate weaknesses → Gemini → single targeted drill
  → Gemini 2.5 Flash
  → MongoDB Atlas (Session, Roadmap collections)
```

**AI pipeline (`server/ai/`):**
- `llm.js` — opening-question generator + streaming variant, persona/company/language prompt building, `getAI()` (BYOK with platform fallback), name-placeholder stripping, centralized `mapGeminiError`, `hasUsableApiKey`.
- `evaluate.js` — scores 0–10 as strict JSON; coding mode adds time/space complexity; 429 retry w/ backoff; graceful fallback for too-short answers.
- `followUp.js` — adaptive next question from prior score + target difficulty; streaming variant; language-aware.
- `resumeParser.js` — resume text (truncated to 4000 chars) → structured profile JSON; returns `null` on failure.
- `mentor.js` — 4-week roadmap + 3 projects as JSON.
- `coach.js` — cross-session weakness aggregation → one targeted drill.

**Models:**
- `Session` — `sessionId`, `clerkId`, `role`, `currentQuestion`, `currentDifficulty`, `globalStrengths[]`, `globalWeaknesses[]`, `history[]{question,answer,difficulty,evaluation{...}}`, `status`.
- `Roadmap` — cached mentor output keyed by `clerkId` (indexed).

---

## 5. Feature status matrix

Legend: ✅ implemented & build-verified · 🟡 implemented, runtime unverified · ⚠️ implemented but has a defect · 📄 README-only / partial

| Feature | Status | Notes |
|---|---|---|
| Opening question generation (streaming) | 🟡 | Code complete; needs live Gemini to confirm. |
| Answer evaluation (JSON, 0–10) | 🟡 | Robust parsing + retry + fallback. |
| Adaptive follow-up | 🟡 | Difficulty derived from evaluation field, not a separate step. |
| Coding round (Monaco, 8 langs) | ⚠️ | Editor works; **code is LLM-evaluated only — NOT executed.** No sandbox. README/UI imply correctness/complexity grading; there is no real test-case execution. |
| Resume upload & parse | 🟡 | 5 MB limit, PDF-only filter, memory storage, not persisted server-side. |
| Voice TTS (ElevenLabs + fallback) | 🟡 | Needs user ElevenLabs key for premium path; browser fallback otherwise. |
| Voice STT (Deepgram + fallback) | 🟡 | Needs user Deepgram key; browser SpeechRecognition fallback. |
| Profile / history + charts | ⚠️ | Works, but **client-side auth only** — `GET /interview/user/:clerkId` is unauthenticated (see §6). |
| Nexus Mentor roadmap | 🟡 | Cached in `Roadmap`; PDF export client-side. |
| AI Coach (drill) | 🟡 | Not in README; fully wired in UI + backend. |
| PDF report export | 🟡 | jsPDF, client-side. |
| Admin / placement intelligence | 📄 | **Does not exist.** No admin routes, roles, requirements, matching, or batch analytics. |
| Structured skill profile | 📄 | **Does not exist.** Only per-session strengths/weaknesses strings + raw scores. |
| RAG learning layer | 📄 | **Does not exist.** Mentor uses LLM knowledge only. |
| 3D digital twin avatar | 📄 | **Does not exist.** `InterviewerAvatar.js` is a 2D CSS/SVG circle with sound-wave bars — not a 3D model. |
| Multi-voice / multi-language | 🟡 | English/Hindi/Hinglish in prompts + TTS; no provider abstraction layer yet. |

---

## 6. Defects, risks & gaps (prioritized)

### Critical — access control / multi-tenant data isolation
- `GET /interview/user/:clerkId`, `GET /interview/session/:id`, `DELETE /interview/session/:id`, and `/mentor/:clerkId`, `/coach/analyze/:clerkId` **trust the `clerkId`/`:id` in the URL or body**. There is **no server-side verification of the Clerk session/JWT**. Any unauthenticated caller can read or delete another user's sessions by guessing/knowing an id. This violates the product's own privacy requirement (§15 of the brief) and must be fixed before any admin/placement data is added.
- CORS allows **any** `*.vercel.app` origin (`index.js`). Broad; combined with the above, any Vercel-hosted page can call the API.

### High — coding assessment correctness claim
- Coding answers are scored by the LLM only. The UI shows "correctness", time/space complexity, and a "Neural Score" that can read as verified execution. Per the brief, we must **not** claim test-case execution without a real sandbox. Either (a) relabel as "LLM review, not executed", or (b) add a sandboxed runner (e.g. Judge0 / isolated container). Recommended: relabel now, sandbox later.

### High — lint failing (blocks clean CI)
- `npm run lint` → **19 errors, 3 warnings**. Breakdown:
  - `react/no-unescaped-entities` (several) in `page.js`, `CompanyPicker.js`.
  - `@next/next/no-html-link-for-pages` in `profile/page.js:213` (`<a href="/">` → should be `next/link`).
  - `react-hooks/*`: `submitAnswer` used before declaration inside a timer `useEffect` (`page.js:387`) + missing-dependency warning. This is a real temporal-dead-zone-style hazard worth fixing.

### Medium — Next.js 16 deprecations (build warns, still passes)
- `middleware.js` convention is **deprecated → rename/port to `proxy`** per Next 16. `client/AGENTS.md` explicitly warns that this Next version has breaking changes; the `node_modules/next/dist/docs/` guides should be consulted before touching routing/middleware.
- Multi-lockfile root inference warning: lockfiles at repo root, `client/`, and `C:\Users\hp\`. Set `turbopack.root` in `next.config.mjs` to silence and make builds deterministic.

### Medium — data model limits for the product vision
- No `User`/role model → cannot support candidate vs interviewer vs admin.
- No normalized, evidence-based **skill profile** → analytics and matching cannot be built reliably yet.
- Scores are raw 0–10 per answer with no normalization, confidence, or "insufficient evidence" handling.

### Low — code hygiene
- Dead/duplicate paths: legacy non-streaming `generateQuestion`/`generateFollowUp` and `/interview/answer` route coexist with the streaming paths; legacy path is **not** language-aware. Keep for compat but mark deprecated.
- `client/app/page.js` is 1265 lines mixing canvas animation, API calls, voice, timer, and UI — should be decomposed before adding avatar/skill panels.
- No automated tests anywhere (`server` test script errors by design).

### Secrets
- `.env` files are gitignored and **not tracked** — good. `server/.env` on disk contains a real `MONGO_URI` (Atlas string, embeds credentials). Will not be printed or committed; treat as live and rotate if the folder was shared.

---

## 7. What is safe to build on

- The Express routing + Mongoose service layer is clean and extensible (`services/session.js`, `services/mentor.js`).
- The AI layer already centralizes client creation, error mapping, and language handling in `llm.js` — the right place to add structured-output validation.
- The `Roadmap` model + `aggregateUserData` already do cross-session aggregation — a natural seed for the skill-profile engine.
- Build passes on Node 22, so the toolchain is healthy.

---

## 8. Immediate conclusion

The core candidate-facing app (interview → evaluate → follow-up → history → mentor/coach) is **real and largely functional**, modulo runtime verification against live Gemini/Mongo. The four big product-vision pillars — **skill profile, admin/placement intelligence, RAG, 3D twin** — are **not implemented** and must be built. Before any of that, two things must be repaired because everything else depends on them:

1. **Server-side authorization** (no feature that exposes candidate data can be trusted until this exists).
2. **An evidence-based skill-profile data model** (the shared substrate for analytics, matching, RAG targeting, and avatar indicators).

See `IMPLEMENTATION_PLAN.md` for sequencing.
