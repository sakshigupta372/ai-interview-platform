const express = require("express");
const router = express.Router();

const { streamQuestionChunks, getUserKey, platformKeyAvailable, mapGeminiError } = require("../ai/llm");
const { evaluateAnswer } = require("../ai/evaluate");
const { generateFollowUp, streamFollowUpChunks } = require("../ai/followUp");
const { synthesizeSpeech } = require("../ai/tts");
const sessionService = require("../services/session");
const userService = require("../services/user");
const { requireAuth, loadOwnedSession } = require("../middleware/auth");

const MAX_QUESTIONS = 5;
const KEY_REQUIRED = "Gemini API key required.";

// Returns the key to pass to the AI helpers (null = platform key), or undefined
// when this session is not allowed to use the platform key.
function sessionApiKey(session, userApiKey) {
  const ownKey = getUserKey(userApiKey);
  if (ownKey) return ownKey;
  if (session.usesPlatformKey && platformKeyAvailable()) return null;
  return undefined;
}

function sseSetup(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post("/speak", async (req, res) => {
  const { text, language } = req.body || {};
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return res.status(400).json({ error: "text required" });
  try {
    const buf = await synthesizeSpeech(raw, language || "English");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  } catch (error) {
    console.error("speak error:", error.message);
    res.status(502).json({ error: "Voice synthesis failed" });
  }
});

// FREE QUOTA — how many interviews this user can still run on the platform key
router.get("/quota", requireAuth, async (req, res) => {
  try {
    const quota = await userService.getQuota(req.auth.userId);
    res.json({ ...quota, platformKeyAvailable: platformKeyAvailable() });
  } catch (error) {
    console.error("quota error:", error);
    res.status(500).json({ error: "Could not load your free interviews." });
  }
});

// 1. START — streaming version (creates session + streams opening question)
router.post("/stream-start", requireAuth, async (req, res) => {
  const clerkId = req.auth.userId;
  const { role, userApiKey, resumeContext, isCodingRound, candidateName, drillFocus, language } = req.body;
  if (!role) return res.status(400).json({ error: "Role is required" });

  const ownKey = getUserKey(userApiKey);
  let usesPlatformKey = false;
  if (!ownKey) {
    if (!platformKeyAvailable()) return res.status(400).json({ error: KEY_REQUIRED });
    let grant;
    try {
      grant = await userService.consumeFreeInterview(clerkId);
    } catch (error) {
      console.error("free quota error:", error);
      return res.status(500).json({ error: "Could not check your free interviews. Try again." });
    }
    if (!grant.granted) {
      return res.status(402).json({
        code: "FREE_LIMIT_REACHED",
        error: `You've used your ${grant.limit} free interviews. Add your own free Gemini key to keep practising.`,
      });
    }
    usesPlatformKey = true;
  }

  console.log("stream-start", { role: String(role).slice(0, 80), coding: !!isCodingRound, ownKey: Boolean(ownKey) });
  sseSetup(res);

  let fullQuestion = "";
  try {
    const session = await sessionService.createSession(role, clerkId, { usesPlatformKey });
    sseWrite(res, { type: "session", sessionId: session.sessionId });

    const stream = streamQuestionChunks(role, ownKey, resumeContext || null, !!isCodingRound, candidateName || null, drillFocus || null, language || "English");
    for await (const chunk of stream) {
      fullQuestion += chunk;
      sseWrite(res, { type: "chunk", text: chunk });
    }

    await sessionService.updateCurrentQuestion(session.sessionId, fullQuestion);
    sseWrite(res, { type: "done", fullQuestion });
    res.end();
  } catch (error) {
    console.error("stream-start error:", error);
    if (usesPlatformKey && !fullQuestion) {
      await userService.refundFreeInterview(clerkId).catch((e) => console.error("free quota refund error:", e));
    }
    const mapped = mapGeminiError(error);
    sseWrite(res, { type: "error", error: mapped.error });
    res.end();
  }
});

// 2a. EVALUATE — scores the answer and saves to DB, returns evaluation + isComplete
router.post("/evaluate", requireAuth, async (req, res) => {
  try {
    const { sessionId, answer, userApiKey, isCodingRound, language } = req.body;
    if (!sessionId || !answer) return res.status(400).json({ error: "sessionId and answer are required" });

    const session = await loadOwnedSession(sessionService, req, res, sessionId);
    if (!session) return;
    if (session.status === "completed") return res.status(400).json({ error: "Session already completed." });
    const apiKey = sessionApiKey(session, userApiKey);
    if (apiKey === undefined) return res.status(400).json({ error: KEY_REQUIRED });

    const questionTheyAreAnswering = session.currentQuestion;
    const currentDifficulty = session.currentDifficulty || "Medium";

    const evaluation = await evaluateAnswer(questionTheyAreAnswering, answer, currentDifficulty, apiKey, !!isCodingRound, language || "English");

    await sessionService.updateSessionData(
      sessionId,
      { question: questionTheyAreAnswering, answer, difficulty: currentDifficulty, evaluation },
      evaluation
    );

    const updatedSession = await sessionService.getSession(sessionId);
    const isComplete = updatedSession.history.length >= MAX_QUESTIONS;

    if (isComplete) await sessionService.endSession(sessionId);

    res.json({
      evaluation,
      isComplete,
      sessionSummary: updatedSession,
      nextDifficulty: updatedSession.currentDifficulty,
    });
  } catch (error) {
    console.error("evaluate error:", error);
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

// 2b. STREAM-NEXT — streams the follow-up question after evaluate
router.post("/stream-next", requireAuth, async (req, res) => {
  const { sessionId, answer, userApiKey, resumeContext, isCodingRound, candidateName, evaluationScore, nextDifficulty, language } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  let session;
  try {
    session = await loadOwnedSession(sessionService, req, res, sessionId);
  } catch (error) {
    console.error("stream-next lookup error:", error);
    return res.status(500).json({ error: "Database fetch failed" });
  }
  if (!session) return;
  const apiKey = sessionApiKey(session, userApiKey);
  if (apiKey === undefined) return res.status(400).json({ error: KEY_REQUIRED });

  sseSetup(res);

  try {
    let fullQuestion = "";
    const stream = streamFollowUpChunks(
      session.role,
      session.currentQuestion,
      answer || "",
      evaluationScore ?? 5,
      nextDifficulty || session.currentDifficulty || "Medium",
      apiKey,
      !!isCodingRound,
      resumeContext || null,
      candidateName || null,
      language || "English"
    );

    for await (const chunk of stream) {
      fullQuestion += chunk;
      sseWrite(res, { type: "chunk", text: chunk });
    }

    await sessionService.updateCurrentQuestion(sessionId, fullQuestion);
    sseWrite(res, { type: "done", fullQuestion });
    res.end();
  } catch (error) {
    console.error("stream-next error:", error);
    const mapped = mapGeminiError(error);
    sseWrite(res, { type: "error", error: mapped.error });
    res.end();
  }
});

// 2. LEGACY — SUBMIT ANSWER, EVALUATE & NEXT (kept for backward compat)
router.post("/answer", requireAuth, async (req, res) => {
  try {
    const { sessionId, answer, userApiKey, resumeContext, isCodingRound, candidateName } = req.body;
    if (!sessionId || !answer) return res.status(400).json({ error: "sessionId and answer are required" });

    const session = await loadOwnedSession(sessionService, req, res, sessionId);
    if (!session) return;
    if (session.status === "completed") return res.status(400).json({ error: "This interview session is already completed." });
    const apiKey = sessionApiKey(session, userApiKey);
    if (apiKey === undefined) return res.status(400).json({ error: KEY_REQUIRED });

    const questionTheyAreAnswering = session.currentQuestion;
    const currentDifficulty = session.currentDifficulty || "Medium";
    const evaluation = await evaluateAnswer(questionTheyAreAnswering, answer, currentDifficulty, apiKey, !!isCodingRound);

    await sessionService.updateSessionData(
      sessionId,
      { question: questionTheyAreAnswering, answer, difficulty: currentDifficulty, evaluation },
      evaluation
    );

    const updatedSession = await sessionService.getSession(sessionId);
    if (updatedSession.history.length >= MAX_QUESTIONS) {
      await sessionService.endSession(sessionId);
      return res.json({ evaluation, isComplete: true, message: "Interview complete!", sessionSummary: updatedSession });
    }

    const nextQuestion = await generateFollowUp(
      updatedSession.role, questionTheyAreAnswering, answer,
      evaluation.score, updatedSession.currentDifficulty, apiKey,
      !!isCodingRound, resumeContext || null, candidateName || null
    );
    await sessionService.updateCurrentQuestion(sessionId, nextQuestion);

    res.json({
      evaluation, isComplete: false, nextQuestion,
      currentQuestionNumber: updatedSession.history.length + 1,
      totalQuestions: MAX_QUESTIONS,
      sessionSummary: updatedSession,
    });
  } catch (error) {
    console.error("Error processing answer:", error);
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

// 3. GET SESSION
router.get("/session/:id", requireAuth, async (req, res) => {
  try {
    const session = await loadOwnedSession(sessionService, req, res, req.params.id);
    if (!session) return;
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// 4. GET ALL SESSIONS BY USER
router.get("/user/:clerkId", requireAuth, async (req, res) => {
  if (req.params.clerkId !== req.auth.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const sessions = await sessionService.getSessionsByUser(req.auth.userId);
    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user profiles" });
  }
});

// 5. DELETE SESSION
router.delete("/session/:id", requireAuth, async (req, res) => {
  try {
    const owned = await loadOwnedSession(sessionService, req, res, req.params.id);
    if (!owned) return;
    const deleted = await sessionService.deleteSession(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Session not found" });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

module.exports = router;
