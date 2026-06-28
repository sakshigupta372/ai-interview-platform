const { getAI, getFirstName, stripNamePlaceholders } = require("./llm");

async function generateFollowUp(role, previousQuestion, userAnswer, evaluationScore, difficulty, userApiKey = null, isCodingRound = false, resumeContext = null, candidateName = null) {
  const firstName = getFirstName(resumeContext, candidateName);
  const prompt = isCodingRound ? `
You are a technical interviewer conducting a coding interview for a ${role} position.

Previous Problem: "${previousQuestion}"
Candidate's Code: "${userAnswer.substring(0, 500)}"
Score: ${evaluationScore}/10
Target Difficulty: ${difficulty}

Generate the NEXT coding problem at ${difficulty} level.
- If they scored well (7+): introduce a harder variation or new concept
- If they scored okay (4-6): try a related but slightly different problem
- If they struggled (<4): simplify and give a more approachable problem

Output ONLY the next coding problem with its examples. No extra text.
` : `
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
${firstName ? `- You may use the candidate's first name (${firstName}) naturally — never [Candidate Name]` : "- Do not use name placeholders like [Candidate Name]"}
`;

  try {
    const client = getAI(userApiKey);
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return stripNamePlaceholders(response.text.trim(), firstName);
  } catch (error) {
    console.error("Follow-Up Error:", error);
    throw new Error("Failed to generate follow-up question");
  }
}

module.exports = { generateFollowUp };
