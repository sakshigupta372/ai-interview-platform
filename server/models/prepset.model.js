const mongoose = require("mongoose");

// One latest interview-prep set per user (replaced on regenerate).
const PrepSetSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true, index: true },
  targetRole: { type: String, default: "Software Engineer" },
  language: { type: String, default: "English" },
  linkedinUrl: { type: String, default: "" },
  resumeContext: { type: mongoose.Schema.Types.Mixed, default: null },
  questions: [{
    _id: false,
    id: String,
    category: String,
    question: String,
    bullets: [String],
    fullScript: String,
    star: { situation: String, task: String, action: String, result: String },
  }],
}, { timestamps: true });

module.exports = mongoose.model("PrepSet", PrepSetSchema);
