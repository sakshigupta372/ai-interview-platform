const { getAI } = require("./llm");

async function generateFollowUp(role, previousQuestion, userAnswer, evaluationScore, difficulty, userApiKey = null) {
  const prompt = `
You are an adaptive expert interviewer interviewing a candidate for a ${role} position.

Context:
Previous Question: "${previousQuestion}"
Candidate's Answer: "${userAnswer}"
Evaluation Score: ${evaluationScore}/10
Target Level for Next Question: ${difficulty}

Instructions:
1. Generate the NEXT interview question based on the candidate's performance.
2. Match the Target Level (${difficulty}) — Easy = beginner concept, Medium = working professional, Hard = senior/expert.
3. Ask ONE focused question only — not multiple questions in one.
4. Keep questions concise and clear — avoid overly long scenario descriptions.
5. If they scored poorly (below 5), ask a simpler clarifying question on the same topic.
6. If they scored well (7+), build on the topic with a slightly deeper angle.
7. Provide ONLY the question as a plain string. No intro text, no markdown.

Next Question:
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
