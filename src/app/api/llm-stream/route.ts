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
// Added optional correlationId
const llmStreamInputSchema = z.object({
    history: z.array(
        z.object({
            role: z.enum(["user", "model"]),
            content: z.string(),
            // Include other fields if needed, but only role/content are sent to Gemini
        })
    ),
    latestUserMessageContent: z.string(),
    correlationId: z.string().optional(), // Optional ID for the placeholder message
});

// Initialize Gemini Client (outside the handler for potential reuse)
const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
    },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
});

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
        // Destructure correlationId as well
        const { history, latestUserMessageContent, correlationId } =
            parseResult.data;
        console.log(
            `[SSE] Received request. CorrelationId: ${correlationId ?? "N/A"}`
        );

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
                    console.log(
                        `[SSE START] Starting generation. CorrelationId: ${
                            correlationId ?? "N/A"
                        }`
                    );
                    const chat = model.startChat({
                        history: formattedHistory,
                        generationConfig: DEFAULT_GENERATION_CONFIG,
                    });

                    const result = await chat.sendMessageStream(latestUserMessageContent);

                    // Stream chunks
                    for await (const chunk of result.stream) {
                        // Check if the stream was cancelled (e.g., client disconnected)
                        // Note: This requires more robust cancellation handling, potentially involving AbortController
                        // if the underlying SDK supports it well with streams. For now, we rely on the loop break.

                        const chunkText = chunk.text();
                        if (chunkText) {
                            // Format as SSE message: data: <json-stringified-chunk>\n\n
                            const message = `data: ${JSON.stringify(chunkText)}\n\n`;
                            // console.log(`[SSE DATA] Sending chunk for ${correlationId ?? 'N/A'}: ${chunkText.substring(0, 50)}...`); // Log chunk start
                            controller.enqueue(encoder.encode(message));
                        }
                    }
                    // Signal completion
                    const doneMessage = "event: done\ndata: {}\n\n";
                    controller.enqueue(encoder.encode(doneMessage));
                    console.log(
                        `[SSE DONE] Stream completed. CorrelationId: ${
                            correlationId ?? "N/A"
                        }`
                    );
                    controller.close();
                } catch (error) {
                    console.error(
                        `[SSE ERROR] LLM generation failed. CorrelationId: ${
                            correlationId ?? "N/A"
                        }:`,
                        error
                    );
                    const errorMessage =
                        error instanceof Error ? error.message : "Unknown LLM error";
                    // Signal error
                    const errorEvent = `event: error\ndata: ${JSON.stringify({
                        message: `LLM Error: ${errorMessage}`,
                    })}\n\n`;
                    controller.enqueue(encoder.encode(errorEvent));
                    controller.close(); // Close stream on error
                }
            },
            cancel(reason) {
                console.log(
                    `[SSE CANCEL] Stream cancelled. CorrelationId: ${
                        correlationId ?? "N/A"
                    }. Reason:`,
                    reason
                );
                // Optional: Add logic here if the Gemini SDK needs explicit cancellation
            },
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                // Optional: Add CORS headers if needed for different origins
                // 'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error("[SSE ERROR] General error in handler:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
