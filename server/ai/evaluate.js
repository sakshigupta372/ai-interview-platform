const { getAI, extractResponseText } = require("./llm");

// Helper: sleep for ms milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluateAnswer(question, answer, currentDifficulty = "Medium", userApiKey = null, isCodingRound = false) {
  const prompt = isCodingRound ? `
You are an expert coding interviewer evaluating a candidate's solution.

Problem: ${question}
Candidate's Code:
${answer}

Return ONLY a valid JSON object matching the schema exactly. No markdown blocks, no extra text.

{
  "score": <number between 0 and 10>,
  "correctness": "<does the solution correctly solve the problem?>",
  "clarity": "<code readability, naming conventions, structure>",
  "confidence": "<inference from the approach and style used>",
  "suggestions": "<specific, actionable code improvements>",
  "ideal_answer": "<a clean optimal solution with brief explanation>",
  "detected_strengths": ["<string>", "<string>"],
  "detected_weaknesses": ["<string>", "<string>"],
  "suggested_next_difficulty": "<'Easy' | 'Medium' | 'Hard'>",
  "time_complexity": "<Big-O time complexity of candidate's solution>",
  "space_complexity": "<Big-O space complexity of candidate's solution>"
}
` : `
You are an expert ${currentDifficulty}-level interviewer.

Evaluate the candidate's answer.

Question: ${question}
Answer: ${answer}

Return ONLY a valid JSON object matching the schema exactly. No markdown blocks, no extra text.

{
  "score": <number between 0 and 10>,
  "correctness": "<conversational feedback on whether the answer was correct, like a human reviewer would say>",
  "clarity": "<casual note on how clearly they communicated>",
  "confidence": "<observation on their confidence level from how they wrote>",
  "suggestions": "<friendly, specific tip on what they could improve — like a mentor talking>",
  "ideal_answer": "<a concise, clear model answer a strong candidate would give>",
  "detected_strengths": ["<string>", "<string>"],
  "detected_weaknesses": ["<string>", "<string>"],
  "suggested_next_difficulty": "<'Easy' | 'Medium' | 'Hard'>"
}
`;

  // Retry up to 3 times with exponential backoff for 429 rate limits
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const client = getAI(userApiKey);
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      let textData = extractResponseText(response);

      const firstBrace = textData.indexOf("{");
      const lastBrace = textData.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("AI did not return a valid JSON object.");
      }

      const cleanedText = textData.substring(firstBrace, lastBrace + 1);
      return JSON.parse(cleanedText);

    } catch (error) {
      const isRateLimit = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota");

      if (isRateLimit && attempt < 3) {
        const waitTime = attempt * 8000; // 8s, then 16s
        console.warn(`⚠️  Gemini rate limit hit. Retrying in ${waitTime / 1000}s... (attempt ${attempt}/3)`);
        await sleep(waitTime);
        continue;
      }

      // If answer is too short/garbage, return a graceful fallback instead of crashing
      if (answer.trim().split(/\s+/).length < 5) {
        console.warn("Answer too short — returning fallback evaluation.");
        return {
          score: 1,
          correctness: "The answer was too brief to evaluate properly.",
          clarity: "Very low clarity — no substantive content provided.",
          confidence: "Cannot assess confidence from this response.",
          suggestions: "Please provide a detailed, structured answer of at least a few sentences.",
          ideal_answer: "A complete answer should address the concept, provide an example, and cover edge cases.",
          detected_strengths: [],
          detected_weaknesses: ["Extremely brief response", "No technical depth shown"],
          suggested_next_difficulty: "Easy",
          ...(isCodingRound && { time_complexity: "N/A", space_complexity: "N/A" })
        };
      }

      console.error("Evaluation Error:", error.message || error);
      throw new Error("Failed to evaluate answer");
    }
  }
}

module.exports = { evaluateAnswer };
