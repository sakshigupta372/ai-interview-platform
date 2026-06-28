const express = require("express");
const router = express.Router();

const { generateQuestion } = require("../ai/llm");
const { evaluateAnswer } = require("../ai/evaluate");
const { generateFollowUp } = require("../ai/followUp");
const sessionService = require("../services/session");

const MAX_QUESTIONS = 5;

// 1. START INTERVIEW SESSION
router.post("/start", async (req, res) => {
  try {
    const { role, clerkId, userApiKey, resumeContext, isCodingRound } = req.body;
    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    const question = await generateQuestion(role, userApiKey, resumeContext || null, !!isCodingRound);
    const session = await sessionService.createSession(role, clerkId);
    await sessionService.updateCurrentQuestion(session.sessionId, question);

    res.json({
      sessionId: session.sessionId,
      role: session.role,
      question: question
    });
  } catch (error) {
    console.error("Error starting session:", error);
    res.status(500).json({ error: "Failed to start interview" });
  }
});

// 2. SUBMIT ANSWER, EVALUATE & NEXT
router.post("/answer", async (req, res) => {
  try {
    const { sessionId, answer, userApiKey, resumeContext, isCodingRound } = req.body;

    if (!sessionId || !answer) {
      return res.status(400).json({ error: "sessionId and answer are required" });
    }

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found in DB" });
    }

    if (session.status === "completed") {
      return res.status(400).json({ error: "This interview session is already completed." });
    }

    const questionTheyAreAnswering = session.currentQuestion;
    const currentDifficulty = session.currentDifficulty || "Medium";

    // 2. Ask Brain 2 (Evaluator) to score the answer and adapt difficulty
    const evaluation = await evaluateAnswer(questionTheyAreAnswering, answer, currentDifficulty, userApiKey, !!isCodingRound);

    // 3. Save Q&A and Strengths/Weaknesses to MongoDB
    await sessionService.updateSessionData(
      sessionId, 
      {
        question: questionTheyAreAnswering,
        answer: answer,
        difficulty: currentDifficulty,
        evaluation: evaluation
      },
      evaluation
    );

    // 4. Check if interview is over 
    const updatedSession = await sessionService.getSession(sessionId);

    if (updatedSession.history.length >= MAX_QUESTIONS) {
      await sessionService.endSession(sessionId);
      return res.json({
        evaluation,
        isComplete: true,
        message: "Interview complete! Data secured.",
        sessionSummary: updatedSession
      });
    }

    // 5. Ask Brain 3 (Follow-up) to generate the next adaptive question based on new Difficulty!
    const nextQuestion = await generateFollowUp(
      updatedSession.role,
      questionTheyAreAnswering,
      answer,
      evaluation.score,
      updatedSession.currentDifficulty,
      userApiKey,
      !!isCodingRound
    );

    // Update session state in DB
    await sessionService.updateCurrentQuestion(sessionId, nextQuestion);

    res.json({
      evaluation,
      isComplete: false,
      nextQuestion: nextQuestion,
      currentQuestionNumber: updatedSession.history.length + 1,
      totalQuestions: MAX_QUESTIONS,
      sessionSummary: updatedSession // So the frontend gets live weaknesses!
    });

  } catch (error) {
    console.error("Error processing answer:", error);
    res.status(500).json({ error: "Failed to process answer" });
  }
});

// 3. GET SESSION HISTORY FOR DASHBOARD 
router.get("/session/:id", async (req, res) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// 4. GET ALL SESSIONS BY USER (CLERK ID)
router.get("/user/:clerkId", async (req, res) => {
  try {
    const sessions = await sessionService.getSessionsByUser(req.params.clerkId);
    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user profiles" });
  }
});

module.exports = router;
