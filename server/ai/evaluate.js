const { ai } = require("./llm");

async function evaluateAnswer(question, answer, currentDifficulty = "Medium") {
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

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });
    
    let textData = response.text || "";
    if (typeof response.text === 'function') {
      textData = response.text();
    }
    
    const firstBrace = textData.indexOf('{');
    const lastBrace = textData.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
       throw new Error("AI did not return a valid JSON object.");
    }
    
    const cleanedText = textData.substring(firstBrace, lastBrace + 1);

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Evaluation Error:", error.message || error);
    throw new Error("Failed to evaluate answer");
  }
}

module.exports = { evaluateAnswer };
