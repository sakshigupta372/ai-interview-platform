const { ai } = require("./llm");

async function generateFollowUp(role, previousQuestion, userAnswer, evaluationScore, difficulty) {
  const prompt = `
You are an adaptive expert interviewer interviewing a candidate for a ${role} position.

Context:
Previous Question: "${previousQuestion}"
Candidate's Answer: "${userAnswer}"
Evaluation Score: ${evaluationScore}/10
Target Level for Next Question: ${difficulty}

Instructions:
1. Based on the candidate's previous answer and score, generate the NEXT question.
2. The new question MUST match the requested Target Level (${difficulty}).
3. If they scored poorly, ask a clarifying follow up. If they scored well, ask a harder question or introduce a new complex twist within the same topic.
4. Provide ONLY the next question as a plain string. No extra text, no markdown.

Next Question:
`;

  try {
    const response = await ai.models.generateContent({
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
