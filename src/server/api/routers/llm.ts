// src/server/api/routers/llm.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { env } from "~/env";

// Import the configuration settings
import {
    MODEL_NAME,
    SYSTEM_PROMPT,
    DEFAULT_GENERATION_CONFIG,
    DEFAULT_SAFETY_SETTINGS,
} from "~/server/llm/config"; // Adjusted path

// Initialize Gemini Client using the configured model name
const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    // Pass system prompt and safety settings during model initialization
    // Note: systemInstruction can also be passed to startChat, but this is cleaner
    // if it's always the same for this model instance.
    systemInstruction: {
        role: "system", // Or omit role if the SDK handles it
        parts: [{ text: SYSTEM_PROMPT }],
    },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
});

export const llmRouter = createTRPCRouter({
    generateResponseStream: protectedProcedure
        .input(
            z.object({
                quizId: z.string(),
                latestUserMessageContent: z.string(),
            })
        )
        .subscription(async function* ({ ctx, input }) {
            const userId = ctx.session.user.id;

            // --- Authorization & History Fetch (from Prisma) ---
            const quiz = await ctx.db.quiz.findUnique({
                where: { id_userId: { id: input.quizId, userId: userId } },
                include: {
                    messages: {
                        orderBy: { createdAt: "asc" },
                        // Consider limiting history depth based on token limits
                        // takeLast: 20, // Example
                    },
                },
            });

            if (!quiz) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Quiz not found or access denied.",
                });
            }

            // --- Format History for Gemini (from Prisma data) ---
            const formattedHistory: Content[] = quiz.messages.map((msg) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }],
            }));

            // --- Start Generation ---
            try {
                console.log(`[LLM] Generating stream for quiz ${input.quizId}`);
                // Start chat using the formatted history and default generation config
                const chat = model.startChat({
                    history: formattedHistory,
                    // Pass generation config here
                    generationConfig: DEFAULT_GENERATION_CONFIG,
                    // Safety settings are often set at model level, but can be overridden here too
                    // safetySettings: DEFAULT_SAFETY_SETTINGS,
                });

                // Send the client-provided latest user message content
                const result = await chat.sendMessageStream(
                    input.latestUserMessageContent
                );

                // --- Stream Chunks ---
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        yield chunkText;
                    }
                }
                console.log(`[LLM] Stream completed for quiz ${input.quizId}`);
            } catch (error) {
                console.error(
                    `[LLM ERROR] Failed generating stream for quiz ${input.quizId}:`,
                    error
                );
                const err = error instanceof Error ? error : new Error(String(error));
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `LLM generation failed: ${err.message}`,
                    cause: err,
                });
            }
        }),
});

