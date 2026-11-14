const express = require("express");
const multer = require("multer");
const router = express.Router();

const PrepSet = require("../models/prepset.model");
const { requireAuth } = require("../middleware/auth");
const { extractPdfText } = require("../services/pdfText");
const { extractResumeContext } = require("../ai/resumeParser");
const { generatePrepSet } = require("../ai/prep");
const { getUserKey, mapGeminiError } = require("../ai/llm");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
}).single("resume");

// Matches https://www.linkedin.com/in/<slug> (and country subdomains). The URL is
// only stored: LinkedIn blocks automated reads, so the app never fetches it.
const LINKEDIN_RE = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/[\w\-%.]+\/?(\?.*)?$/i;

const LANGUAGES = ["English", "Hindi", "Hinglish"];

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(400).json({ error: tooBig ? "Resume must be 5 MB or smaller." : err.message || "Upload failed." });
  });
}

// POST /prep/generate  (multipart: optional `resume` PDF + text fields)
router.post("/generate", requireAuth, handleUpload, async (req, res) => {
  const clerkId = req.auth.userId;
  const targetRole = String(req.body.targetRole || "").trim().slice(0, 80);
  const userApiKey = req.body.userApiKey || null;
  const linkedinUrl = String(req.body.linkedinUrl || "").trim();
  const linkedinText = String(req.body.linkedinText || "").trim().slice(0, 6000);
  const language = LANGUAGES.includes(req.body.language) ? req.body.language : "English";

  if (!targetRole) return res.status(400).json({ error: "Target role is required." });
  if (!getUserKey(userApiKey)) return res.status(400).json({ error: "Add your own Gemini API key to generate a prep set." });
  if (linkedinUrl && !LINKEDIN_RE.test(linkedinUrl)) {
    return res.status(400).json({ error: "That doesn't look like a LinkedIn profile URL (https://www.linkedin.com/in/...)." });
  }

  try {
    let resumeContext = null;
    if (req.file) {
      let text;
      try {
        text = await extractPdfText(req.file.buffer);
      } catch {
        return res.status(422).json({ error: "We couldn't read that PDF. Try exporting it again, or skip the resume." });
      }
      if (!text) return res.status(422).json({ error: "Could not read any text from this PDF. Is it a scanned image?" });
      resumeContext = await extractResumeContext(text, userApiKey);
    }

    const questions = await generatePrepSet({ resumeContext, linkedinText, targetRole, language, userApiKey });

    const prep = await PrepSet.findOneAndUpdate(
      { clerkId },
      { clerkId, targetRole, language, linkedinUrl, resumeContext, questions },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    res.json({ prep, resumeParsed: Boolean(resumeContext) || !req.file });
  } catch (error) {
    console.error("prep generate error:", error?.message || error);
    if (error instanceof SyntaxError) {
      return res.status(502).json({ error: "The AI returned malformed data. Please try again." });
    }
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

// GET /prep/latest
router.get("/latest", requireAuth, async (req, res) => {
  try {
    const prep = await PrepSet.findOne({ clerkId: req.auth.userId });
    res.json({ prep: prep || null });
  } catch (error) {
    console.error("prep fetch error:", error);
    res.status(500).json({ error: "Failed to load interview prep." });
  }
});

module.exports = router;
