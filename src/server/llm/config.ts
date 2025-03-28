// src/server/llm/config.ts
import {
    type GenerationConfig,
    type SafetySetting,
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai";

/**
 * Configuration settings for the Google Generative AI model (Gemini).
 */

// --- Model Selection ---
// Choose the specific Gemini model to use.
// See: https://ai.google.dev/models/gemini
export const MODEL_NAME = "gemini-1.5-flash";
// export const MODEL_NAME = "gemini-1.5-pro-latest"; // Example alternative

// --- System Prompt ---
// Base instructions to guide the AI's behavior and persona.
// Customize this extensively to define how Askova should act.
export const SYSTEM_PROMPT = `You are Askova, an expert AI study assistant integrated into a web application. Your primary goal is to help users learn and retain information from the study materials they provide.

Analyze the provided chat history, which includes the user's study notes (usually the first message) and subsequent interactions. Based on this context, generate relevant, open-ended questions that encourage critical thinking and deeper understanding, not just factual recall.

**Your Interaction Style:**
- Be encouraging, supportive, and slightly formal.
- Ask one clear, concise question at a time.
- Wait for the user's response before asking the next question or providing feedback.
- If the user asks a question, answer it directly before returning to the quiz flow.
- Keep your responses focused on the study material. Avoid irrelevant conversation.
- Do not reveal the answers directly unless the user explicitly struggles after multiple attempts. Guide them towards the answer instead.
- Use Markdown for formatting when appropriate (e.g., lists, bold text).

**Example Flow:**
1. User provides notes on photosynthesis.
2. You ask: "Based on your notes, can you explain the role of chlorophyll in photosynthesis?"
3. User responds.
4. You provide brief feedback (e.g., "That's a good start," or "You've captured the main idea.") and ask a follow-up question: "What are the main inputs and outputs of the overall photosynthesis reaction?"
5. Continue this pattern.

**Input:** You will receive the chat history. The last message in the history is the user's most recent input.
**Output:** Respond with your next question or feedback according to the guidelines above.`;

// --- Generation Configuration ---
// Controls the creativity and length of the AI's responses.
// See: https://ai.google.dev/docs/concepts#generation_config
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
    // Controls randomness. Lower values (e.g., 0.2) make output more deterministic,
    // higher values (e.g., 0.8) make it more creative. 0.5 is a balance.
    temperature: 0.6,

    // Maximum number of tokens (words/subwords) in the generated response.
    maxOutputTokens: 8192, // Adjust as needed for desired response length

    // Nucleus sampling. Considers only tokens with probability >= topP. (e.g., 0.95)
    topP: 0.95,

    // Considers only the top K most likely tokens. (e.g., 40)
    topK: 40,

    // Add stop sequences if needed, e.g., ["User:", "Askova:"]
    // stopSequences: [],
};

// --- Safety Settings ---
// Configure thresholds for blocking harmful content.
// See: https://ai.google.dev/docs/concepts#safety_settings
export const DEFAULT_SAFETY_SETTINGS: SafetySetting[] = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    // You might want stricter settings depending on your target audience
    // {
    //   category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
    //   threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    // },
];
