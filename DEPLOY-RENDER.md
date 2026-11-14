# Render Backend Deployment Guide

Deploy the Express API so your Vercel frontend can call it in production.

**Live frontend:** https://ai-interview-platform-one-wine.vercel.app  
**GitHub repo:** https://github.com/sakshigupta372/ai-interview-platform

---

## Overview

```
Vercel (frontend)  →  Render (backend)  →  MongoDB Atlas (database)
```

You need **MongoDB Atlas** first — Render cannot use MongoDB on your PC.

---

## Part 1 — MongoDB Atlas (free, ~5 min)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign up / log in.
2. **Create** → **Deployment** → **MONGODB Atlas** → **Create**.
3. Choose **M0 FREE** → pick a cloud region near you → **Create Deployment**.
4. **Create database user:**
   - Username: e.g. `nexusadmin`
   - Password: generate a strong password → **save it**
5. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)  
   (Required so Render can connect.)
6. **Database** → **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://nexusadmin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<password>` with your real password.
8. Add a database name at the end:
   ```
   mongodb+srv://nexusadmin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/ai-interview-platform?retryWrites=true&w=majority
   ```

Keep this string — you will paste it into Render as `MONGO_URI`.

---

## Part 2 — Deploy on Render (~5 min)

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign up (use **GitHub** login).
2. Click **New +** → **Web Service**.
3. Connect GitHub → select **`sakshigupta372/ai-interview-platform`**.
4. Configure:

   | Setting | Value |
   |---------|--------|
   | **Name** | `ai-interview-platform-api` |
   | **Branch** | `main` |
   | **Root Directory** | `server` |
   | **Runtime** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

5. **Environment Variables**:

   | Key | Value |
   |-----|--------|
   | `MONGO_URI` | Your Atlas connection string |
   | `FRONTEND_URL` | `https://ai-interview-platform-one-wine.vercel.app` |
   | `CLERK_SECRET_KEY` | **Required.** Clerk secret key (see note below) |
   | `ALLOWED_ORIGINS` | Optional. Extra browser origins, comma-separated (custom domain, preview URLs) |
   | `NODE_ENV` | `production` |

   **`CLERK_SECRET_KEY` must come from the same Clerk application as the frontend.** Copy the
   value of `CLERK_SECRET_KEY` from your Vercel project's environment variables. If it belongs to a
   different Clerk app, every signed-in request fails with 401. If it is missing, those requests fail with 503.
   Never commit this key.

6. Click **Create Web Service** → wait until **Live**.
7. Test your URL in browser — should show: `AI Interview Platform API + MongoDB Running...`

---

## Part 3 — Connect Vercel to Render

1. [Vercel Dashboard](https://vercel.com/dashboard) → your project
2. **Settings** → **Environment Variables**
3. Set `NEXT_PUBLIC_API_URL` = `https://YOUR-SERVICE.onrender.com`
4. **Redeploy** the frontend

---

## Releasing the authenticated API (one-time, when upgrading from the old API)

The API now verifies the Clerk session token on every signed-in route, and the frontend now sends it.
The two must go live together:

1. On Render, add `CLERK_SECRET_KEY` (and `ALLOWED_ORIGINS` if needed) **before** deploying.
2. Merge to `main`. Render and Vercel both auto-deploy from `main`.
3. Expect a minute or two where an old frontend talks to the new API (or the reverse). Signed-in pages
   show an error during that window and work once both deploys finish. Deploying Vercel first is harmless.
4. Smoke test on the live site: sign in, start an interview, finish a question, open History and Mentor.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Deploy failed | Render **Logs** — check `MONGO_URI`, Root Directory = `server` |
| MongoDB error | Atlas password, IP `0.0.0.0/0`, database name in URI |
| CORS error / "Origin not allowed" | Add the exact frontend URL to `FRONTEND_URL` or `ALLOWED_ORIGINS` on Render. Wildcard `*.vercel.app` is no longer accepted |
| 503 "Server authentication is not configured" | `CLERK_SECRET_KEY` is missing on Render |
| 401 "Invalid or expired session" on every request | `CLERK_SECRET_KEY` is from a different Clerk app than the frontend's publishable key |
| Slow first request | Render free tier sleeps ~15 min — wait 30–60s |
