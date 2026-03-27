const { GoogleGenAI } = require("@google/genai");

// Initialize Google Gen AI
const ai = new GoogleGenAI({});

async function generateQuestion(role) {
  const prompt = `
You are a senior interviewer.
Ask a technical interview question for a ${role}.
Keep it realistic and not too easy. Do not include any extra text, just the question itself.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Failed to generate question");
  }
}

module.exports = { generateQuestion, ai };
