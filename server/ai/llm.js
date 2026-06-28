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
You are a friendly interviewer conducting a real-world job interview for a ${role}.

Ask ONE clear, simple opening question. 

Rules (strictly follow):
- Difficulty: EASY-MEDIUM — something a junior-to-mid level candidate can answer confidently
- ONE concept only — do not combine multiple topics into one question
- Max 1-2 sentences long
- No long scenario setups or storytelling
- No expert-level or architecture-level questions for the opener
- Ask something like: "What is X?", "How does X work?", "What is the difference between X and Y?" or "When would you use X?"
- Output ONLY the question, nothing else
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
