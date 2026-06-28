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

async function generateQuestion(role, userApiKey, resumeContext = null, isCodingRound = false) {
  let prompt;

  if (isCodingRound) {
    prompt = `You are a technical interviewer conducting a coding interview for a ${role} position.
Generate ONE coding problem. Include:
1. Clear problem statement
2. Input/Output format
3. Constraints
4. 1-2 examples with expected output

Output ONLY the problem. No extra commentary.`;
  } else {
    const resumeSection = resumeContext
      ? `\nCandidate Profile:\n- Recent Role: ${resumeContext.recent_role} at ${resumeContext.recent_company}\n- Experience: ${resumeContext.years_experience} years\n- Top Skills: ${(resumeContext.top_skills || []).join(", ")}\n- Background: ${resumeContext.summary}\n\nTailor the question to their specific background and the target role.`
      : "";

    prompt = `You are a real human interviewer having a casual but professional conversation with a candidate for a ${role} role.${resumeSection}

Start the interview naturally — like you would in a real Zoom call or in-person interview. Sound warm, human, and direct.

Rules:
- ONE concept, easy-to-medium difficulty
- 1-2 sentences max
- Sound like a person, not a textbook
- Do NOT say "As an AI" or "As your interviewer" — just talk naturally
- Output ONLY what the interviewer says (the question itself)`;
  }

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
