const express = require("express");
const router = express.Router();
const sessionService = require("../services/session");
const { runCoachAgent } = require("../ai/coach");
const { getUserKey, mapGeminiError } = require("../ai/llm");
const { requireAuth } = require("../middleware/auth");

// POST /coach/analyze/:clerkId
// Body: { userApiKey, targetRole? }
// Returns: { stats, coaching }
router.post("/analyze/:clerkId", requireAuth, async (req, res) => {
  if (req.params.clerkId !== req.auth.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const clerkId = req.auth.userId;
  const { userApiKey, targetRole } = req.body;

  if (!getUserKey(userApiKey)) {
    return res.status(400).json({ error: "Add your own Gemini API key to use the AI coach." });
  }

  try {
    const sessions = await sessionService.getSessionsByUser(clerkId);
    if (!sessions.length) {
      return res.status(404).json({ error: "No sessions found. Complete at least one interview first." });
    }

    const result = await runCoachAgent(sessions, targetRole || null, userApiKey);
    res.json(result);
  } catch (error) {
    console.error("Coach agent error:", error);
    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: "AI returned malformed data. Try again." });
    }
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

module.exports = router;
