const express = require("express");
const router = express.Router();
const multer = require("multer");
const { extractPdfText } = require("../services/pdfText");
const { extractResumeContext } = require("../ai/resumeParser");
const { getUserKey, platformKeyAvailable } = require("../ai/llm");
const { requireAuth } = require("../middleware/auth");
const userService = require("../services/user");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  }
});

router.post("/parse", requireAuth, (req, res, next) => {
  upload.single("resume")(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(400).json({ error: tooBig ? "Resume must be 5 MB or smaller." : err.message || "Upload failed." });
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Without their own key, users may read a resume on the platform key only
    // while they still have free interviews to spend it on.
    const ownKey = getUserKey(req.body.userApiKey);
    if (!ownKey) {
      const quota = platformKeyAvailable() ? await userService.getQuota(req.auth.userId) : null;
      if (!quota || quota.remaining <= 0) {
        return res.status(400).json({ error: "Add your Gemini API key to read your resume." });
      }
    }

    const text = await extractPdfText(req.file.buffer);
    if (!text) return res.status(422).json({ error: "Could not read any text from this PDF." });
    const context = await extractResumeContext(text, ownKey);
    res.json({ context });
  } catch (err) {
    console.error("Resume route error:", err.message);
    res.status(500).json({ error: "Failed to parse resume" });
  }
});

module.exports = router;
