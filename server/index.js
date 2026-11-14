const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("./db"); // Import DB 

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    const allowed = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://ai-interview-platform-nr7v.vercel.app",
      "https://ai-interview-platform-one-wine.vercel.app",
      process.env.FRONTEND_URL,
      // Extra origins (e.g. a custom domain or a Vercel preview), comma-separated.
      ...(process.env.ALLOWED_ORIGINS || "").split(","),
    ].map((o) => (o || "").trim().replace(/\/$/, "")).filter(Boolean);
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (allowed.includes(origin) || local) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

// Connect Server to MongoDB before accepting traffic.

const interviewRoute = require("./routes/interview");
const mentorRoute = require("./routes/mentor");
const resumeRoute = require("./routes/resume");
const coachRoute = require("./routes/coach");
const prepRoute = require("./routes/prep");
const { rateLimit } = require("./middleware/rateLimit");

// Unauthenticated, cost-bearing endpoints: cap requests per IP.
app.set("trust proxy", 1); // Render sits behind one proxy
app.use("/interview/speak", rateLimit({ windowMs: 60_000, max: 30 }));
app.use("/resume", rateLimit({ windowMs: 60_000, max: 10 }));

app.use("/interview", interviewRoute);
app.use("/mentor", mentorRoute);
app.use("/resume", resumeRoute);
app.use("/coach", coachRoute);
app.use("/prep", prepRoute);

app.get("/", (req, res) => {
  res.send("NEXUS.AI API + MongoDB Running...");
});

// Uptime pings hit this to keep the free Render instance awake.
app.get("/healthz", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ ok: dbUp, db: dbUp ? "connected" : "disconnected" });
});

// Last-resort error handler: JSON only, never a stack trace or file paths.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const isCors = typeof err?.message === "string" && err.message.startsWith("CORS:");
  const status = isCors ? 403 : (err?.status >= 400 && err?.status < 500 ? err.status : 500);
  if (status === 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: isCors ? "Origin not allowed." : status === 500 ? "Internal server error." : "Bad request." });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
