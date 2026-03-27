const { getAI } = require("./llm");

// Helper: sleep for ms milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluateAnswer(question, answer, currentDifficulty = "Medium", userApiKey = null) {
  const prompt = `
You are an expert ${currentDifficulty}-level interviewer.

Evaluate the candidate's answer.

Question: ${question}
Answer: ${answer}

Return ONLY a valid JSON object matching the schema exactly. No markdown blocks, no extra text.

{
  "score": <number between 0 and 10>,
  "correctness": "<string explaining correctness>",
  "clarity": "<string explaining clarity>",
  "confidence": "<string inferring confidence from text>",
  "suggestions": "<string for improvement>",
  "ideal_answer": "<string providing the ideal answer>",
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

      let textData = response.text || "";
      if (typeof response.text === "function") {
        textData = response.text();
      }

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
          suggested_next_difficulty: "Easy"
        };
      }

      console.error("Evaluation Error:", error.message || error);
      throw new Error("Failed to evaluate answer");
    }
  }
}

module.exports = { evaluateAnswer };
