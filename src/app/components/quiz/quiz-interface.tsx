// src/app/components/quiz/quiz-interface.tsx
"use client";

import React, {
    type FormEvent,
    useCallback, // Import useCallback
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type ChatMessage, db } from "~/db/dexie";
import { QuizInput } from "~/app/components/quiz/quiz-input";
import { useLiveQuery } from "dexie-react-hooks";
import { useSendChatMessage } from "~/app/hooks/useSendChatMessage";
import { v4 as uuidv4 } from "uuid";
import { ChatMessageService } from "~/services/chatMessageService";

interface QuizInterfaceProps {
    quizId: string;
}

interface SseErrorData {
    message: string;
}

function isSseErrorData(obj: unknown): obj is SseErrorData {
    return typeof obj === "object" && obj !== null && true;
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { sendMessageAndUpdate } = useSendChatMessage();
    const abortControllerRef = useRef<AbortController | null>(null);

    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () =>
            db.chatMessages
                .where("quizId")
                .equals(quizId)
                .sortBy("createdAt"),
        [quizId] // Dependency: Re-run query if quizId changes
    );

    const localMessages: ChatMessage[] = useMemo(
        () => liveMessages ?? [],
        [liveMessages]
    );

    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => setIsLoaded(true), 50);
        return () => clearTimeout(timer);
    }, [quizId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, [quizId]);

    // --- Refactored SSE Stream Processing ---
    const processStream = useCallback(
        async (
            reader: ReadableStreamDefaultReader<Uint8Array>,
            decoder: TextDecoder,
            modelMessageId: string
        ) => {
            let buffer = "";

            const finalizeModelMessage = async (
                status: ChatMessage["status"],
                contentOverride?: string
            ) => {
                const message = await ChatMessageService.getLocalMessageById(
                    modelMessageId
                );
                if (!message) {
                    console.error(
                        `[SSE Client] Cannot finalize message ${modelMessageId}: Not found in Dexie.`
                    );
                    return;
                }
                if (message.status === "done" || message.status === "error") {
                    console.warn(
                        `[SSE Client] Attempted to re-finalize message ${modelMessageId} which is already ${message.status}.`
                    );
                    return;
                }
                const finalMessage: ChatMessage = {
                    ...message,
                    status: status,
                    content: contentOverride ?? message.content,
                };
                try {
                    // Use service directly instead of hook here for consistency within processStream
                    await ChatMessageService.addOrUpdateLocalMessage(
                        finalMessage
                    );
                    console.log(
                        `[SSE Client] Finalized message ${modelMessageId} with status ${status}.`
                    );
                } catch (error) {
                    console.error(
                        `[SSE Client] Error finalizing message ${modelMessageId}:`,
                        error
                    );
                    await ChatMessageService.updateLocalMessageStatus(
                        modelMessageId,
                        "error",
                        "Failed to finalize message state."
                    );
                }
            };

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log("[SSE Client] Stream finished.");
                        await finalizeModelMessage("done");
                        break;
                    }
                    buffer += decoder.decode(value, { stream: true });
                    let boundary = buffer.indexOf("\n\n");
                    while (boundary !== -1) {
                        const message = buffer.substring(0, boundary);
                        buffer = buffer.substring(boundary + 2);
                        if (message.startsWith("event: done")) {
                            console.log("[SSE Client] Received done event.");
                            await finalizeModelMessage("done");
                        } else if (message.startsWith("event: error")) {
                            const dataLine = message
                                .split("\n")
                                .find((l) => l.startsWith("data: "));
                            let displayErrorMessage =
                                "An error occurred while generating the response.";
                            if (dataLine) {
                                const errorJson = dataLine.substring(6);
                                try {
                                    const parsedErrorData = JSON.parse(
                                        errorJson
                                    ) as unknown;
                                    if (isSseErrorData(parsedErrorData)) {
                                        console.error(
                                            "[SSE Client] Received error event:",
                                            parsedErrorData
                                        );
                                        if (
                                            parsedErrorData.message.includes(
                                                "SAFETY"
                                            )
                                        ) {
                                            displayErrorMessage =
                                                "The response could not be generated due to safety guidelines. Please try rephrasing your input or asking a different question.";
                                        } else {
                                            displayErrorMessage = `LLM Error: ${
                                                parsedErrorData.message
                                                    .split(":")
                                                    .slice(-1)[0]
                                                    ?.trim() ?? "Unknown issue"
                                            }`;
                                        }
                                    } else {
                                        console.error(
                                            "[SSE Client] Received error event with unexpected structure:",
                                            parsedErrorData
                                        );
                                        displayErrorMessage =
                                            "Received a malformed error from the server.";
                                    }
                                } catch (e) {
                                    console.error(
                                        "[SSE Client] Error parsing error JSON:",
                                        e,
                                        errorJson
                                    );
                                    displayErrorMessage =
                                        "Failed to understand the error from the server.";
                                }
                            } else {
                                displayErrorMessage =
                                    "Received an unspecified error from the server.";
                            }
                            await finalizeModelMessage(
                                "error",
                                displayErrorMessage
                            );
                            return;
                        } else if (message.startsWith("data: ")) {
                            const dataJson = message.substring(6);
                            try {
                                const parsedData = JSON.parse(
                                    dataJson
                                ) as unknown;
                                if (typeof parsedData === "string") {
                                    await ChatMessageService.appendLocalMessageContent(
                                        modelMessageId,
                                        "streaming",
                                        parsedData
                                    );
                                } else {
                                    console.warn(
                                        "[SSE Client] Received non-string data chunk:",
                                        parsedData
                                    );
                                }
                            } catch (e) {
                                console.error(
                                    "[SSE Client] Error parsing data JSON:",
                                    e,
                                    dataJson
                                );
                            }
                        }
                        boundary = buffer.indexOf("\n\n");
                    }
                }
            } catch (error) {
                let errorMsg = "Stream reading failed";
                if ((error as Error).name === "AbortError") {
                    console.log("[SSE Client] Stream fetch aborted.");
                    errorMsg = "Stream cancelled";
                } else {
                    console.error("[SSE Client] Error reading stream:", error);
                }
                await finalizeModelMessage("error", errorMsg);
            } finally {
                reader.releaseLock();
                setIsTyping(false);
            }
        },
        []
    );

    // --- NEW: Function to Trigger AI Response ---
    const triggerAIResponse = useCallback(
        async (userMessage: ChatMessage, history: ChatMessage[]) => {
            if (!quizId || isTyping) return; // Don't trigger if already typing

            console.log(
                `[AI Trigger] Triggering AI for message ${userMessage.id} in quiz ${quizId}`
            );

            abortControllerRef.current?.abort(); // Abort any ongoing stream
            const controller = new AbortController();
            abortControllerRef.current = controller;

            // Prepare history for the API call (excluding the user message itself)
            const historyForApi = history.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            const modelMessageId = uuidv4();
            const modelMessagePlaceholder: ChatMessage = {
                id: modelMessageId,
                quizId: quizId,
                role: "model",
                content: "", // Start empty
                createdAt: new Date(userMessage.createdAt.getTime() + 1), // Ensure it's after user msg
                status: "waiting", // Initial status
            };

            setIsTyping(true); // Start loading indicator

            try {
                // Save AI placeholder locally *before* API call
                await ChatMessageService.addOrUpdateLocalMessage(
                    modelMessagePlaceholder
                );

                // Make API call to SSE endpoint
                const response = await fetch("/api/llm-stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        // Send history *before* the current user message
                        history: historyForApi,
                        // Send the content of the user message that triggers this response
                        latestUserMessageContent: userMessage.content,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    let errorText = "API request failed";
                    try {
                        errorText = await response.text();
                    } catch (_) {
                        /* ignore */
                    }
                    const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
                    console.error("[SSE Client]", errorMessage);
                    await ChatMessageService.updateLocalMessageStatus(
                        modelMessageId,
                        "error",
                        errorMessage
                    );
                    setIsTyping(false);
                    return;
                }

                if (!response.body) {
                    console.error("[SSE Client] Response body is null");
                    await ChatMessageService.updateLocalMessageStatus(
                        modelMessageId,
                        "error",
                        "Received empty response from server"
                    );
                    setIsTyping(false);
                    return;
                }

                // Process the stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                await processStream(reader, decoder, modelMessageId);
            } catch (error) {
                if ((error as Error).name !== "AbortError") {
                    console.error(
                        "[AI Trigger] Error triggering AI response:",
                        error
                    );
                    await ChatMessageService.updateLocalMessageStatus(
                        modelMessageId,
                        "error",
                        error instanceof Error
                            ? error.message
                            : "Failed to get response"
                    );
                    setIsTyping(false);
                } else {
                    console.log("[AI Trigger] Fetch aborted.");
                    // Update status if aborted before streaming starts
                    await ChatMessageService.updateLocalMessageStatus(
                        modelMessageId,
                        "error",
                        "Request cancelled"
                    );
                    setIsTyping(false);
                }
            }
        },
        [quizId, isTyping, processStream] // Dependencies for useCallback
    );

    // --- Effect to Trigger Initial AI Response ---
    useEffect(() => {
        // Check conditions:
        // 1. We have messages loaded (`localMessages` is not empty).
        // 2. There is exactly ONE message.
        // 3. That message is from the 'user'.
        // 4. The AI is not already 'typing'.
        if (
            localMessages &&
            localMessages.length === 1 &&
            localMessages[0]?.role === "user" &&
            !isTyping
        ) {
            console.log(
                `[Initial Trigger] Detected new quiz ${quizId} with one user message. Triggering AI.`
            );
            const firstMessage = localMessages[0];
            // Call the trigger function with the first message and an empty history
            // Use void to explicitly ignore the promise return if not needed here
            void triggerAIResponse(firstMessage, []);
        }
    }, [quizId, localMessages, isTyping, triggerAIResponse]); // Dependencies

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        // Don't submit if no input, no quizId, or AI is already typing
        if (!trimmedInput || !quizId || isTyping) return;

        const userMessageId = uuidv4();
        const userMessage: ChatMessage = {
            id: userMessageId,
            quizId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
            status: "done", // User messages are immediately 'done'
        };

        setInput(""); // Clear input optimistically

        // Prepare history *before* adding the new user message
        const historyBeforeNewMessage = [...localMessages];

        try {
            // 1. Save the user's message locally (and sync if needed via hook)
            await sendMessageAndUpdate(userMessage);

            // 2. Trigger the AI response using the new message and the history *before* it
            await triggerAIResponse(userMessage, historyBeforeNewMessage);
        } catch (error) {
            // Error handling specifically for saving the user message (less likely)
            console.error("Error saving user message before triggering AI:", error);
            // Optionally: Revert UI changes or show error to user
        }
    };

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 relative w-full">
                <ScrollArea className="h-full w-full">
                    <div
                        className={cn(
                            "mx-auto max-w-4xl space-y-4 p-4 pb-36 transition-opacity duration-150",
                            isLoaded ? "opacity-100" : "opacity-0"
                        )}
                    >
                        {localMessages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${
                                    message.role === "user"
                                        ? "justify-end"
                                        : "justify-start"
                                }`}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-lg p-3 md:p-4",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground",
                                        "shadow-sm",
                                        message.status === "waiting" &&
                                        "opacity-70 italic",
                                        message.status === "streaming" &&
                                        "opacity-90",
                                        message.status === "error" &&
                                        "bg-destructive/20 text-destructive border border-destructive"
                                    )}
                                    style={{ overflowWrap: "break-word" }}
                                >
                                    <div className="markdown">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {message.status === "waiting"
                                                ? "..."
                                                : message.content}
                                        </ReactMarkdown>
                                    </div>
                                    {message.status === "error" && (
                                        <p className="text-xs mt-1 text-destructive/80">
                                            Error receiving response.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping &&
                            localMessages[localMessages.length - 1]?.role !==
                            "model" && (
                                <div className="flex justify-start">
                                    <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                                        <div className="flex space-x-2">
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                                            <div className="animation-delay-100 h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                                            <div className="animation-delay-200 h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                <QuizInput
                    input={input}
                    onInputChange={(e) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    isTyping={isTyping}
                    disabled={!quizId}
                />
            </div>
        </div>
    );
}
