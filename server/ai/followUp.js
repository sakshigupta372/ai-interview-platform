const { getAI } = require("./llm");

async function generateFollowUp(role, previousQuestion, userAnswer, evaluationScore, difficulty, userApiKey = null) {
  const prompt = `
You are a human interviewer having a real conversation with a candidate for a ${role} role.

What just happened:
- You asked: "${previousQuestion}"
- They answered: "${userAnswer}"
- Their score internally: ${evaluationScore}/10
- Next difficulty target: ${difficulty}

Now respond like a real interviewer would — naturally react to what they said, then ask the next question.

How to sound human:
- If they did well (score 7+): briefly acknowledge it ("Nice, that's right." / "Good." / "Yeah exactly.") then go deeper
- If they were okay (score 4-6): neutral transition ("Okay, let's move on." / "Got it, let's try another one.")  
- If they struggled (score below 4): be encouraging ("No worries, let's try a different angle." / "Let's simplify a bit.")
- Keep reactions SHORT — 1 sentence max, then ask the question
- ONE question only, concise, match the ${difficulty} level
- Sound like a person on a video call, not a formal document
- Output ONLY what the interviewer says next (reaction + question), nothing else
`;

  try {
    const client = getAI(userApiKey);
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Follow-Up Error:", error);
    throw new Error("Failed to generate follow-up question");
  }
}

module.exports = { generateFollowUp };
