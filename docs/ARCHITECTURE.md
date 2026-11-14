# NEXUS.AI — Architecture

> Living document. Date: 2026-10-26.
> Status tags: **[Verified]** build/read-confirmed · **[Unverified]** needs live run · **[Planned]** not yet built.

## Current architecture (as built) — [Verified by source read + client build]

```
Browser (Next.js 16 App Router, Vercel)
  ├─ Clerk auth (homepage public; UI gated by components)
  ├─ BYOK Gemini key in sessionStorage (never sent to our DB)
  ├─ Resume PDF → POST /resume/parse
  └─ axios + SSE → Express
Express 5 (Render)
  ├─ /interview  (stream-start SSE, evaluate, stream-next SSE, answer[legacy], session CRUD)
  ├─ /resume/parse
  ├─ /mentor     (GET aggregate profile, POST generate roadmap)
  └─ /coach/analyze
  → Google Gemini 2.5 Flash (@google/genai)
  → MongoDB Atlas (Mongoose): Session, Roadmap
```

- Frontend pages: `/` (simulator), `/profile` (history + charts), `/mentor` (roadmap + coach).
- Shared libs: `lib/api.js`, `lib/brand.js`, `lib/tts.js` (ElevenLabs+fallback), `lib/deepgramSTT.js` (Deepgram+fallback), `lib/companies.js`.
- AI layer centralizes client creation, error mapping, language handling in `server/ai/llm.js`.

## Known architectural issues — [Verified]
- No server-side identity verification; routes trust `clerkId`/`:id` from the request (see audit §6).
- CORS allows any `*.vercel.app` origin.
- Coding answers are LLM-evaluated, not executed (no sandbox).
- `client/app/page.js` (1265 lines) mixes concerns.

## Target architecture additions — [Planned]
- Clerk backend auth middleware + role-based authorization.
- `SkillProfile` as the shared data substrate (feeds dashboard, admin matching, RAG targeting, avatar).
- Admin/placement module (requirements, matching, analytics, shortlists).
- RAG retrieval store (candidate: Atlas Vector Search) grounding Nexus Mentor.
- React Three Fiber 3D avatar layer, lazy-loaded with 2D fallback.
- Provider-abstracted voice (TTS/STT) synced to avatar state.

_Diagrams and per-module detail will be expanded as each phase lands._
