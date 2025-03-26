// src/app/components/quiz-interface.tsx
"use client";

import React, {
    useState,
    useRef,
    useEffect,
    useMemo,
    type FormEvent,
    useCallback,
} from "react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db, type ChatMessage } from "~/db/dexie";
import { QuizInput } from "~/app/components/quiz/quiz-input";
import { useLiveQuery } from "dexie-react-hooks";
import { useSendChatMessage } from "~/app/hooks/useSendChatMessage";
import { v4 as uuidv4 } from "uuid"; // Import uuid
import { ChatMessageService } from "~/services/chatMessageService";

interface QuizInterfaceProps {
    quizId: string;
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false); // Indicates AI is processing/responding
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { sendMessageAndUpdate } = useSendChatMessage(); // Hook for saving & potential sync

    // --- State for managing the SSE connection ---
    const abortControllerRef = useRef<AbortController | null>(null);

    // Use Dexie Live Query to always read all messages for this session.
    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () =>
            db.chatMessages
                .where("quizId")
                .equals(quizId)
                .sortBy("createdAt"),
        [quizId]
    );

    const localMessages: ChatMessage[] = useMemo(
        () => liveMessages ?? [],
        [liveMessages]
    );

    // Trigger fade-in on quizId change
    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => setIsLoaded(true), 50);
        return () => clearTimeout(timer);
    }, [quizId]);

    // Auto-scroll on message updates
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    // --- Cleanup SSE connection on unmount or quizId change ---
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort(); // Abort ongoing fetch if component unmounts/changes
        };
    }, [quizId]); // Rerun cleanup if quizId changes

    // --- Handle SSE Stream ---
    const processStream = useCallback(
        async (
            reader: ReadableStreamDefaultReader<Uint8Array>,
            decoder: TextDecoder,
            modelMessageId: string
        ) => {
            let buffer = "";
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log("[SSE Client] Stream finished.");
                        await ChatMessageService.updateLocalMessageStatus(
                            modelMessageId,
                            "done"
                        );
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    // Process buffer line by line for SSE messages
                    let boundary = buffer.indexOf("\n\n");
                    let errorData: unknown;
                    let chunkText: unknown;
                    while (boundary !== -1) {
                        const message = buffer.substring(0, boundary);
                        buffer = buffer.substring(boundary + 2);

                        if (message.startsWith("event: done")) {
                            console.log("[SSE Client] Received done event.");
                            // Final status update might happen here or after loop finishes
                            await ChatMessageService.updateLocalMessageStatus(
                                modelMessageId,
                                "done"
                            );
                            // Optionally break if 'done' event guarantees stream end
                            // break;
                        } else if (message.startsWith("event: error")) {
                            const dataLine = message.split("\n").find(l => l.startsWith("data: "));
                            if (dataLine) {
                                const errorJson = dataLine.substring(6);
                                errorData = JSON.parse(errorJson);
                                console.error("[SSE Client] Received error event:", errorData);
                                await ChatMessageService.updateLocalMessageStatus(
                                    modelMessageId,
                                    "error",
                                );
                            }
                            // Stop processing on error
                            return;
                        } else if (message.startsWith("data: ")) {
                            const dataJson = message.substring(6);
                            try {
                                chunkText = JSON.parse(dataJson);
                                if (typeof chunkText === "string") {
                                    // Append content chunk
                                    await ChatMessageService.appendLocalMessageContent(
                                        modelMessageId,
                                        "streaming",
                                        chunkText
                                    );
                                }
                            } catch (e) {
                                console.error("[SSE Client] Error parsing data JSON:", e, dataJson);
                            }
                        }
                        boundary = buffer.indexOf("\n\n");
                    }
                }
            } catch (error) {
                // Handle fetch errors or unexpected stream closure
                if ((error as Error).name === 'AbortError') {
                    console.log("[SSE Client] Stream fetch aborted.");
                    // Optionally update status to 'cancelled' or just leave as is
                    await ChatMessageService.updateLocalMessageStatus(modelMessageId, "error");
                } else {
                    console.error("[SSE Client] Error reading stream:", error);
                    await ChatMessageService.updateLocalMessageStatus(
                        modelMessageId,
                        "error",
                    );
                }
            } finally {
                reader.releaseLock();
                setIsTyping(false); // Ensure typing indicator stops
            }
        },
        [] // No dependencies needed for the function logic itself
    );

    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || !quizId || isTyping) return;

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const userMessageId = uuidv4();
        const userMessage: ChatMessage = {
            id: userMessageId,
            quizId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
            status: "done",
        };

        setInput("");

        const historyForApi = [
            ...localMessages,
            userMessage,
        ].map((msg) => ({ role: msg.role, content: msg.content }));

        const modelMessageId = uuidv4();
        const modelMessagePlaceholder: ChatMessage = {
            id: modelMessageId,
            quizId: quizId,
            role: "model",
            content: "",
            createdAt: new Date(userMessage.createdAt.getTime() + 1),
            status: "waiting",
        };

        // --- Start API Interaction ---
        setIsTyping(true); // Start loading indicator *before* try block

        try {
            // Save user message and AI placeholder locally *before* API call
            await sendMessageAndUpdate(userMessage);
            await ChatMessageService.addOrUpdateLocalMessage(
                modelMessagePlaceholder
            );

            // --- Make API call to SSE endpoint ---
            const response = await fetch("/api/llm-stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: historyForApi.slice(0, -1),
                    latestUserMessageContent: userMessage.content,
                }),
                signal: controller.signal,
            });

            // --- Handle non-OK response directly ---
            if (!response.ok) {
                let errorText = "API request failed";
                try {
                    // Try to get more specific error text from the response
                    errorText = await response.text();
                } catch (_) {
                    // Ignore error reading response body if it fails
                }
                const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
                console.error("[SSE Client]", errorMessage);
                // Update placeholder to show error
                await ChatMessageService.updateLocalMessageStatus(
                    modelMessageId,
                    "error",
                    errorMessage
                );
                setIsTyping(false); // Stop loading indicator
                return; // Exit handleSubmit early
            }

            // --- Handle OK response ---
            if (!response.body) {
                // Handle case where response is OK but body is null
                console.error("[SSE Client] Response body is null");
                await ChatMessageService.updateLocalMessageStatus(
                    modelMessageId,
                    "error",
                    "Received empty response from server"
                );
                setIsTyping(false);
                return; // Exit handleSubmit early
            }

            // --- Process the stream ---
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            // processStream now handles setting isTyping(false) in its finally block
            await processStream(reader, decoder, modelMessageId);

        } catch (error) {
            // This catch block now primarily handles errors *during* fetch (network issues)
            // or errors *before* fetch (e.g., saving to Dexie failed - though less likely here)
            // It also catches AbortError if the fetch itself is aborted.
            if ((error as Error).name !== 'AbortError') {
                console.error("Error sending message or processing stream:", error);
                // Update placeholder to show error
                await ChatMessageService.updateLocalMessageStatus(
                    modelMessageId,
                    "error",
                    error instanceof Error ? error.message : "Failed to get response"
                );
                setIsTyping(false); // Stop loading indicator on error
            } else {
                console.log("[SSE Client] Fetch aborted.");
                // Status update for abort is handled in processStream's finally block
                // or here if the fetch itself was aborted before streaming started.
                // Ensure isTyping is false if abort happens before processStream runs.
                setIsTyping(false);
            }
        }
        // No finally block needed here for setIsTyping, as processStream handles it
        // and the non-OK path also sets it to false before returning.
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
                                    message.role === "user" ? "justify-end" : "justify-start"
                                }`}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-lg p-3 md:p-4",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground",
                                        "shadow-sm",
                                        // Add visual feedback for non-'done' states
                                        message.status === "waiting" && "opacity-70 italic",
                                        message.status === "streaming" && "opacity-90",
                                        message.status === "error" && "bg-destructive/20 text-destructive border border-destructive"
                                    )}
                                    style={{ overflowWrap: "break-word" }}
                                >
                                    <div className="markdown">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {/* Show placeholder text or error */}
                                            {message.status === 'waiting' ? '...' : message.content}
                                        </ReactMarkdown>
                                    </div>
                                    {/* Optional: Display explicit error status */}
                                    {message.status === 'error' && (
                                        <p className="text-xs mt-1 text-destructive/80">Error receiving response.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {/* Typing indicator now controlled by isTyping state */}
                        {isTyping && localMessages[localMessages.length - 1]?.role !== 'model' && ( // Only show if last message isn't the model streaming
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
                    isTyping={isTyping} // Disable input while AI is responding
                    disabled={!quizId}
                />
            </div>
        </div>
    );
}
