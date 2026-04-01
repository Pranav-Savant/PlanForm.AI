import Groq from "groq-sdk";
import { GROQ_API_KEY } from "../config/config.js";

const client = new Groq({ apiKey: GROQ_API_KEY });

// Free tier TPM limits (as of 2025):
// llama-3.3-70b-versatile: 12,000 TPM
// llama3-8b-8192:          6,000 TPM
const MODEL_FALLBACK_CHAIN = ["llama-3.3-70b-versatile", "llama3-8b-8192"];

// Keep final prompt safely under the lowest model's TPM (~6000 tokens ≈ 24000 chars).
// We target 3500 tokens of input to leave room for system text + output.
const MAX_DATA_CHARS = 12000;

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5000;
const EXPLANATION_MAX_TOKENS = 1024;
const CHAT_MAX_TOKENS = 220;
const CHAT_MAX_WORDS = 110;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const truncateToWordLimit = (text, maxWords) => {
  if (typeof text !== "string") return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
};

/**
 * Recursively trims any JS object to stay within token budget:
 * - Limits arrays to `maxItems` entries
 * - Limits string values to `maxStrLen` characters
 * - Strips keys whose values are large arrays of primitives (raw data dumps)
 * - Goes only `maxDepth` levels deep
 */
const deepTrim = (
  value,
  maxItems = 3,
  maxStrLen = 120,
  maxDepth = 4,
  depth = 0,
) => {
  if (depth > maxDepth) return "…";

  if (Array.isArray(value)) {
    const sliced = value.slice(0, maxItems);
    const trimmed = sliced.map((v) =>
      deepTrim(v, maxItems, maxStrLen, maxDepth, depth + 1),
    );
    if (value.length > maxItems)
      trimmed.push(`…(${value.length - maxItems} more)`);
    return trimmed;
  }

  if (value !== null && typeof value === "object") {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      // Skip keys that are clearly raw data dumps (arrays of numbers/strings with many items)
      if (Array.isArray(v) && v.length > 10 && typeof v[0] !== "object") {
        result[k] = `[${v.length} items omitted]`;
        continue;
      }
      result[k] = deepTrim(v, maxItems, maxStrLen, maxDepth, depth + 1);
    }
    return result;
  }

  if (typeof value === "string" && value.length > maxStrLen) {
    return value.slice(0, maxStrLen) + "…";
  }

  return value;
};

/**
 * Trims projectData to fit within MAX_DATA_CHARS.
 * Progressively tightens constraints until it fits.
 */
const trimProjectData = (projectData) => {
  const raw = JSON.stringify(projectData);
  if (raw.length <= MAX_DATA_CHARS) return projectData;

  // Try progressively more aggressive trimming
  const configs = [
    { maxItems: 3, maxStrLen: 120, maxDepth: 4 },
    { maxItems: 2, maxStrLen: 80, maxDepth: 3 },
    { maxItems: 1, maxStrLen: 60, maxDepth: 2 },
  ];

  for (const cfg of configs) {
    const trimmed = deepTrim(
      projectData,
      cfg.maxItems,
      cfg.maxStrLen,
      cfg.maxDepth,
    );
    const result = JSON.stringify(trimmed);
    console.log(
      `[AI] Trim attempt (maxItems=${cfg.maxItems}, maxStrLen=${cfg.maxStrLen}): ` +
        `${raw.length} chars → ${result.length} chars`,
    );
    if (result.length <= MAX_DATA_CHARS) return trimmed;
  }

  // Last resort: stringify and hard-truncate with a note
  console.warn("[AI] Hard truncating projectData to fit token limit.");
  const hardTrimmed = deepTrim(projectData, 1, 60, 2);
  const str = JSON.stringify(hardTrimmed);
  return str.length <= MAX_DATA_CHARS
    ? hardTrimmed
    : str.slice(0, MAX_DATA_CHARS) + '…"} (truncated)';
};

const generateWithFallback = async (prompt, options = {}) => {
  const maxTokens = options.maxTokens ?? EXPLANATION_MAX_TOKENS;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[AI] Attempt ${attempt}/${MAX_RETRIES} using model: ${modelName}`,
        );

        const response = await client.chat.completions.create({
          model: modelName,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          response.choices[0]?.message?.content ?? "No response generated.";

        if (modelName !== MODEL_FALLBACK_CHAIN[0]) {
          console.warn(`[AI] Used fallback model: ${modelName}`);
        }

        return text;
      } catch (error) {
        lastError = error;
        const status = error.status ?? error.statusCode;
        const message = error.message ?? "";

        // Model gone or decommissioned — skip to next
        if (
          status === 404 ||
          message.includes("not found") ||
          message.includes("decommissioned")
        ) {
          console.warn(`[AI] Model ${modelName} unavailable. Trying next...`);
          break;
        }

        // Still too large — skip to next model (higher TPM)
        if (status === 413 || message.includes("Request too large")) {
          console.warn(
            `[AI] Prompt too large for ${modelName}. Trying next model...`,
          );
          break;
        }

        // Rate limited — retry with exponential backoff
        if (status === 429) {
          if (attempt < MAX_RETRIES) {
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`[AI] Rate limited. Retrying in ${delay / 1000}s...`);
            await sleep(delay);
            continue;
          }
          console.warn(
            `[AI] Rate limit retries exhausted for ${modelName}. Trying next...`,
          );
          break;
        }

        // Hard error (401, etc.) — stop entirely
        throw error;
      }
    }

    console.error(
      `[AI] All attempts failed for ${modelName}:`,
      lastError?.message,
    );
  }

  throw new Error("All models exhausted. Could not generate AI explanation.");
};

export const generateMaterialExplanation = async (projectData) => {
  const slim = trimProjectData(projectData);

  const prompt = `
You are an AI structural planning assistant.

Your task is to explain construction material recommendations for a building floor plan.

RULES:
- Be practical and realistic, in simple human-readable English.
- Do NOT invent fake engineering calculations.
- Only explain based on the provided data.
- Mention cost, strength, and durability tradeoffs.
- Explain why the top-ranked material is preferred over alternatives.
- Keep explanations concise but useful.
- Output MUST be valid Markdown only (.md friendly).
- Use short sections with Markdown headings (## and ###).
- Use bullet points and compact comparison tables where useful.
- Do not output JSON.
- Do not wrap the full response in triple backticks.
- If data is missing, add a Markdown quote block starting with > Missing data.

Project data:
${typeof slim === "string" ? slim : JSON.stringify(slim, null, 2)}

Return exactly this Markdown structure:

## Overall Project Summary
- 3-5 concise bullets.

## Element-wise Recommendations
For each structural element:
### <element name>
- Top choice and why.
- One important tradeoff.
- A quick alternative option.

## Key Tradeoff Insights
- 3-5 bullets focused on cost vs strength vs durability.

## Final Recommendation
- A compact concluding paragraph.
`;

  try {
    return await generateWithFallback(prompt, {
      maxTokens: EXPLANATION_MAX_TOKENS,
    });
  } catch (error) {
    console.error("Groq AI Error:", error.message);
    return "AI explanation could not be generated at this time. Please try again later.";
  }
};

export const generateChatResponse = async ({
  question,
  aiExplanation,
  contextData,
  chatHistory = [],
}) => {
  const safeExplanation =
    typeof aiExplanation === "string" ? aiExplanation : "";
  const safeQuestion = typeof question === "string" ? question.trim() : "";

  if (!safeQuestion) {
    return "Please ask a question about your analyzed plan.";
  }

  const projectData = contextData ?? {};
  const trimmedProjectData = trimProjectData(projectData);
  const slimHistory = Array.isArray(chatHistory)
    ? chatHistory.slice(-8).map((msg) => ({
        sender: msg?.sender === "user" ? "user" : "assistant",
        text: typeof msg?.text === "string" ? msg.text.slice(0, 600) : "",
      }))
    : [];

  const prompt = `
You are a structural planning assistant for a floor-plan analysis app.

Rules:
- Base your answer only on the provided internal AI explanation and trimmed project data.
- If data is missing, clearly say what is missing instead of inventing facts.
- Keep responses practical, concise, and easy to understand.
- Focus on material choices, structural implications, cost-strength-durability tradeoffs.
- You may perform simple calculations using provided material metrics (cost, strength, durability, thermalEfficiency).
- When calculating, show short steps and assumptions.
- Keep the response very short: maximum 4 lines and about 60-100 words.
- Avoid long introductions and avoid repeating the full context.

Internal AI explanation context (do not expose unless user asks for explanation details):
${safeExplanation || "No explanation provided."}

Trimmed project data:
${typeof trimmedProjectData === "string" ? trimmedProjectData : JSON.stringify(trimmedProjectData, null, 2)}

Recent chat:
${JSON.stringify(slimHistory, null, 2)}

User question:
${safeQuestion}

Provide a direct and precise answer.
`;

  try {
    const rawReply = await generateWithFallback(prompt, {
      maxTokens: CHAT_MAX_TOKENS,
    });

    return truncateToWordLimit(rawReply, CHAT_MAX_WORDS);
  } catch (error) {
    console.error("Groq Chat Error:", error.message);
    return "I could not generate a chat response right now. Please try again.";
  }
};
