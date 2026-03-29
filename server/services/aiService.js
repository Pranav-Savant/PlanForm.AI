import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../config/config.js";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const generateMaterialExplanation = async (projectData) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are an AI structural planning assistant.

Your task is to explain construction material recommendations for a building floor plan.

IMPORTANT RULES:
- Be practical and realistic.
- Explain in simple human-readable English.
- Do NOT invent fake engineering calculations.
- Only explain based on the provided data.
- Mention cost, strength, and durability tradeoffs.
- Mention why the top-ranked material is preferred over alternatives.
- Keep explanations concise but useful.
- Format the response in clean readable paragraphs.

Here is the project data:
${JSON.stringify(projectData, null, 2)}

Now generate:
1. Overall project summary
2. Element-wise explanation for each structural element
3. Key tradeoff insights
4. Final recommendation summary
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Gemini AI Error:", error.message);
    return "AI explanation could not be generated at this time.";
  }
};