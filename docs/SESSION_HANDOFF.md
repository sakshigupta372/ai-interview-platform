# NEXUS.AI - Session Handoff

> Last updated: 2026-11-12. Read this first when resuming.
> It replaces the older handoff, which described the project before any code was changed.

---

## Where we stopped

We were on **item 3: make deployment safe**. Local work for it is finished. What remains needs the user's answers and the Render/Vercel dashboards.

**Nothing is committed.** The branch is `dev`, 6 commits ahead of `main` (`main` has nothing `dev` lacks). Render and Vercel deploy from `main`, so going live means committing, merging `dev` into `main`, and pushing. **Do not push or merge without the user's explicit yes.**

### Questions the user has not answered yet
1. OK to commit on `dev`, merge into `main` and push?
2. Is `https://ai-interview-platform-one-wine.vercel.app` the only live frontend, or is there a custom domain? (It returned 200. The old `nr7v` URL returned 404.)
3. Test locally first? (Recommended.)

### Steps the user must do in dashboards (listed to them, not done)
- **Render:** add `CLERK_SECRET_KEY`, copied from the Vercel project's env vars. It must be from the same Clerk app as the frontend. Confirm `FRONTEND_URL` is the one-wine URL. Set `ALLOWED_ORIGINS` only if extra domains are used.
- **Vercel:** confirm `NEXT_PUBLIC_API_URL` is `https://ai-interview-platform-1-h5tt.onrender.com`.
- After deploy, smoke test on the live site: sign in, finish a question, open History and Mentor, upload a resume.
- Rollback: revert the merge on `main`, or redeploy the previous version from Render's Events tab.

---

## What was done this session (all uncommitted)

**Security (server)**
- `server/middleware/auth.js`: `requireAuth` verifies the Clerk session JWT (`@clerk/backend`) and sets `req.auth.userId`. `loadOwnedSession` returns 404 for missing or not-yours sessions. It fails closed with 503 if `CLERK_SECRET_KEY` is missing.
- Applied to `/interview/*` (all except `/speak`), `/mentor/*`, `/coach/*`, `/prep/*`. The user id comes from the token, never from the URL or body. A mismatched `:clerkId` returns 403.
- `server/index.js`: CORS is an explicit allowlist (localhost, the nr7v and one-wine Vercel URLs, `FRONTEND_URL`, `ALLOWED_ORIGINS`); the `*.vercel.app` wildcard is gone. Added a 1 MB JSON limit, a final JSON error handler (no stack traces, CORS errors return 403), and a per-IP rate limit on `/interview/speak` (30/min) and `/resume` (10/min) in `server/middleware/rateLimit.js`.
- `server/.env` (gitignored) now has `CLERK_SECRET_KEY`, copied from `client/.env.local` without printing it. `server/.env.example` and `render.yaml` list it.

**Client**
- All API calls to protected routes send `Authorization: Bearer <fresh getToken()>` (`app/page.js`, `app/profile/page.js`, `app/mentor/page.js`).
- `middleware.js` was renamed to `proxy.js` (Next 16). The deprecation warning is gone.
- The `submitAnswer` use-before-declare in the timer effect now goes through `submitAnswerRef`.

**Resume upload (restored in the existing UI, no redesign)**
- Root cause of the old breakage: `pdf-parse` 2.x exports a `PDFParse` class and is no longer callable, so `routes/resume.js` always failed. New helper: `server/services/pdfText.js`.
- `components/SetupEngine.js` has a compact upload row above the role input (styles `.nx-resume*` in `app/setup.css`). `app/page.js` owns the state (`resumeFile`, `resumeContext`, `isParsingResume`). A file picked before the API key exists is read once the key is saved. The parsed summary is kept in `localStorage` via `lib/brand.js` (`loadResumeContext` / `saveResumeContext`) and is passed into the interview.
- `/resume/parse` now returns clean 400 JSON for a bad or oversized file.

**Server work with no UI (inert)**
- `/prep/generate` and `/prep/latest`, `server/ai/prep.js`, `server/models/prepset.model.js`. They generate 10 grouped interview questions with Bullets, Full Script and S.T.A.R. answers. The user rejected the new `/onboarding` and `/prep` pages ("don't change UI"), so those pages were deleted. The user asked earlier for this feature, so offer to show it inside existing screens (for example a Mentor tab).

**Docs**
- `README.md` env section updated. `DEPLOY-RENDER.md` has the Clerk key, the release order and troubleshooting. `render.yaml` `FRONTEND_URL` now points at the one-wine URL.

---

## Verified vs not verified

**Verified (ran it)**
- Client build passes; no lint errors in changed files.
- Server: every protected route returns 401 without a token, with a forged token, and with a wrong scheme. `/` returns 200. A disallowed origin gets 403. The rate limiter returns 429 after 10 calls.
- A real PDF goes through `/resume/parse` without crashing. Non-PDF and empty uploads return 400.
- `/prep` validation and output cleanup passed 20 stubbed checks (the temporary script was deleted).

**NOT verified**
- Any signed-in flow in a browser. I had no real Clerk session, so the valid-token path was never exercised.
- A real Gemini call: resume parsing and prep quality were only tested with a fake key and stubs.
- That the live site uses the same Clerk app as the secret key. The check was declined by the user.
- The new upload row has never been seen rendered.

---

## Next options (user chose to do item 3 first)
1. Check it yourself locally (sign in, interview, History, Mentor, resume).
2. Commit in logical chunks (auth, proxy, resume, docs).
3. Deployment safety (in progress, see above).
4. Relabel the coding round honestly ("AI review, code not run") now; a real sandbox (Judge0) later.
5. Show Bullets / Full Script / S.T.A.R. in existing screens (backend ready).
6. Practice Mode with history (from the HireOS screenshots the user shared).
7. Bigger plan items: skill profile, admin/placement, RAG mentor, 3D avatar (needs a rigged model from the user). Details are in `IMPLEMENTATION_PLAN.md`.
8. Cleanup: 10 lint warnings (React effect `setState` rules), `app/page.js` is about 1,300 lines, no automated tests, 12 server dependency vulnerabilities from `npm audit` (not investigated).
9. The earlier Clerk-to-Kinde swap is probably unnecessary now that Clerk is secured. Ask whether the user still wants it.

---

## Rules and gotchas
- **User preferences:** do not change the existing UI. Be fast and direct. "Ask if you want something and go ahead." Do not probe the live sites further (the user declined a live-site check).
- `client/AGENTS.md`: read `client/node_modules/next/dist/docs/` before changing Next.js routing or conventions (Next 16 has breaking changes).
- Never print or commit secrets. `server/.env` holds the Atlas URI and the Clerk secret.
- Dev servers: `npm run dev` through the background tool is blocked with a warning. Start detached with `Start-Process cmd.exe -ArgumentList "/c","npm run dev" -WorkingDirectory <root> -WindowStyle Hidden -RedirectStandardOutput ...`. Logs go to `%TEMP%\nexus-dev\`. They may still be running on ports 3000 and 5000.
- Gemini warnings like "API key should be set" in server logs are normal; the platform key is unset (BYOK).
- `docs/PROJECT_AUDIT.md` is partly out of date: lint now has 0 errors, `turbopack.root` is already set, and the auth gap and the `middleware` to `proxy` rename are fixed. Update it when convenient.
