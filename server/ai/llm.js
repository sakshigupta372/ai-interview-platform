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
You are a real human interviewer having a casual but professional conversation with a candidate for a ${role} role.

Start the interview naturally — like you would in a real Zoom call or in-person interview. Sound warm, human, and direct.

Examples of how a real interviewer starts:
- "Alright, let's kick things off. Can you walk me through how X works?"
- "So to start — what's your understanding of X?"
- "Quick one to get us going — how would you explain X to someone new to it?"
- "Let's start simple — what's the difference between X and Y?"

Rules:
- ONE concept, easy-to-medium difficulty
- 1-2 sentences max
- Sound like a person, not a textbook
- Do NOT say "As an AI" or "As your interviewer" — just talk naturally
- Output ONLY what the interviewer says (the question itself)
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
