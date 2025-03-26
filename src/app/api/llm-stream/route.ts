// src/app/api/llm-stream/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth"; // Use your auth helper
import { db } from "~/server/db"; // Prisma client
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { env } from "~/env";
import {
    MODEL_NAME,
    SYSTEM_PROMPT,
    DEFAULT_GENERATION_CONFIG,
    DEFAULT_SAFETY_SETTINGS,
} from "~/server/llm/config"; // LLM config

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

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        const userId = session.user.id;

        const { searchParams } = new URL(req.url);
        const quizId = searchParams.get("quizId");
        const latestUserMessageContent = searchParams.get(
            "latestUserMessageContent"
        );

        if (!quizId || !latestUserMessageContent) {
            return new NextResponse("Missing quizId or message content", {
                status: 400,
            });
        }

        // --- Authorization & History Fetch (from Prisma) ---
        const quiz = await db.quiz.findUnique({
            where: { id_userId: { id: quizId, userId: userId } },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" },
                    // Consider limiting history depth based on token limits
                    // takeLast: 20, // Example
                },
            },
        });

        if (!quiz) {
            return new NextResponse("Quiz not found or access denied", {
                status: 403,
            });
        }

        // --- Format History for Gemini ---
        const formattedHistory: Content[] = quiz.messages.map((msg) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
        }));

        // --- Start Generation & Create SSE Stream ---
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    console.log(`[SSE] Starting generation for quiz ${quizId}`);
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
                            // Sending plain text is simpler here
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify(chunkText)}\n\n`)
                            );
                        }
                    }
                    // Signal completion
                    controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
                    console.log(`[SSE] Stream completed for quiz ${quizId}`);
                    controller.close();
                } catch (error) {
                    console.error(
                        `[SSE ERROR] LLM generation failed for quiz ${quizId}:`,
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
                console.log(`[SSE] Stream cancelled for quiz ${quizId}`);
            },
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                // Optional: Add CORS headers if needed, though same-origin should be fine
                // 'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error("[SSE ERROR] General error in handler:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
