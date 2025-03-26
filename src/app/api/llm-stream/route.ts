// src/app/api/llm-stream/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { env } from "~/env";
import {
    MODEL_NAME,
    SYSTEM_PROMPT,
    DEFAULT_GENERATION_CONFIG,
    DEFAULT_SAFETY_SETTINGS,
} from "~/server/llm/config"; // LLM config
import { z } from "zod";

// Define the expected input schema for the request body
const llmStreamInputSchema = z.object({
    history: z.array(
        z.object({
            role: z.enum(["user", "model"]),
            content: z.string(),
            // Include other fields if needed, but only role/content are sent to Gemini
        })
    ),
    latestUserMessageContent: z.string(),
    // quizId: z.string().optional(), // Keep if useful for logging
});

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
    },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
});

// --- Change GET to POST ---
export async function POST(req: NextRequest) {
    try {
        // --- Get Data from Request Body ---
        let requestBody: unknown;
        try {
            requestBody = await req.json();
        } catch (parseError) {
            console.error("[SSE ERROR] Invalid JSON body:", parseError);
            return new NextResponse("Invalid request body", { status: 400 });
        }

        // --- Validate Input Body ---
        const parseResult = llmStreamInputSchema.safeParse(requestBody);
        if (!parseResult.success) {
            console.error("[SSE ERROR] Invalid input:", parseResult.error);
            return new NextResponse(
                `Invalid input: ${parseResult.error.message}`,
                { status: 400 }
            );
        }
        const { history, latestUserMessageContent } = parseResult.data;
        // const quizId = parseResult.data.quizId; // Optional for logging

        // --- Format History for Gemini (from request body) ---
        const formattedHistory: Content[] = history.map((msg) => ({
            // Ensure role matches Gemini's expectation ('model' not 'assistant')
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
        }));

        // --- Start Generation & Create SSE Stream ---
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // console.log(`[SSE] Starting generation for quiz ${quizId ?? 'N/A'}`); // Optional logging
                    console.log(`[SSE] Starting generation...`);
                    const chat = model.startChat({
                        history: formattedHistory,
                        generationConfig: DEFAULT_GENERATION_CONFIG,
                    });

                    const result = await chat.sendMessageStream(
                        latestUserMessageContent
                    );

                    // Stream chunks
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            // Format as SSE message: data: <json-stringified-chunk>\n\n
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify(chunkText)}\n\n`)
                            );
                        }
                    }
                    // Signal completion
                    controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
                    // console.log(`[SSE] Stream completed for quiz ${quizId ?? 'N/A'}`); // Optional logging
                    console.log(`[SSE] Stream completed.`);
                    controller.close();
                } catch (error) {
                    console.error(
                        // `[SSE ERROR] LLM generation failed for quiz ${quizId ?? 'N/A'}:`, // Optional logging
                        `[SSE ERROR] LLM generation failed:`,
                        error
                    );
                    const errorMessage =
                        error instanceof Error ? error.message : "Unknown error";
                    // Signal error
                    controller.enqueue(
                        encoder.encode(
                            `event: error\ndata: ${JSON.stringify({ message: `LLM Error: ${errorMessage}` })}\n\n`
                        )
                    );
                    controller.close(); // Close stream on error
                }
            },
            cancel() {
                // console.log(`[SSE] Stream cancelled for quiz ${quizId ?? 'N/A'}`); // Optional logging
                console.log(`[SSE] Stream cancelled.`);
            },
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                // Optional: Add CORS headers if needed
                // 'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error("[SSE ERROR] General error in handler:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
