const { GoogleGenAI } = require("@google/genai");

// Default AI instance using the platform's own env key (fallback)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Returns an AI instance using the user's own key if provided, else falls back to platform key
function getAI(userApiKey) {
  if (userApiKey && userApiKey.trim().length > 10) {
    return new GoogleGenAI({ apiKey: userApiKey.trim() });
  }
  return ai;
}

async function generateQuestion(role, userApiKey) {
  const prompt = `
You are a friendly but professional interviewer.
Ask ONE opening interview question for a ${role}.

Rules:
- Start at MEDIUM difficulty — not beginner, not expert-level
- The question should be clear and answerable in 2-4 sentences
- Avoid multi-part questions (no "describe X, then explain Y, then list Z")
- No obscure edge cases or PhD-level scenarios for the opening question
- Ask about a single, well-known concept that a working professional would know
- Do NOT include any intro text, just the question itself
`;

  try {
    const client = getAI(userApiKey);
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Failed to generate question");
  }
}

module.exports = { generateQuestion, ai, getAI };
