// src/app/components/quiz/quiz-interface.tsx
"use client";

import React, {
    type FormEvent,
    useCallback,
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
import { useLlmStream } from "~/app/hooks/useLlmStream"; // Import the new hook

interface QuizInterfaceProps {
    quizId: string;
}

// TODO: Refactor logic to upload finished AI responses to Prisma


export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false); // Still managed here
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { sendMessageAndUpdate } = useSendChatMessage();

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

    // --- Define Callbacks for the Hook ---
    const handleChunkReceived = useCallback(
        async (messageId: string, chunk: string) => {
            // This replaces the logic inside the 'data:' block of the old processStream
            await ChatMessageService.appendLocalMessageContent(
                messageId,
                "streaming", // Set status to streaming when chunk received
                chunk
            );
        },
        []
    );

    const handleStreamComplete = useCallback(async (messageId: string) => {
        // This replaces the logic inside the 'event: done' block and the finalization logic
        await ChatMessageService.updateLocalMessageStatus(messageId, "done");
        setIsTyping(false); // Stop typing indicator on completion
        console.log(
            `[QuizInterface] Stream completed for message ${messageId}`
        );
    }, []);

    const handleStreamError = useCallback(
        async (
            messageId: string,
            errorMessage: string,
            errorDetails?: unknown
        ) => {
            // This replaces the logic inside the 'event: error' block and catch blocks
            console.error(
                `[QuizInterface] Stream error for message ${messageId}: ${errorMessage}`,
                errorDetails
            );
            // Update the specific message with the error status and content
            await ChatMessageService.updateLocalMessageStatus(
                messageId,
                "error",
                errorMessage // Use the processed error message for display
            );
            setIsTyping(false); // Stop typing indicator on error
        },
        []
    );

    // --- Initialize the Hook ---
    const { startStream, abortStream } = useLlmStream("/api/llm-stream", {
        onChunkReceived: handleChunkReceived,
        onStreamComplete: handleStreamComplete,
        onStreamError: handleStreamError,
    });

    // --- Effects ---
    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => setIsLoaded(true), 50);
        return () => clearTimeout(timer);
    }, [quizId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    // Cleanup effect to abort stream on quiz change or unmount
    useEffect(() => {
        return () => {
            console.log(
                "[QuizInterface] Unmounting or quizId changed, aborting stream."
            );
            abortStream();
        };
    }, [quizId, abortStream]); // Add abortStream as dependency

    // Remove the old processStream useCallback

    // --- Function to Trigger AI Response (Uses the hook's startStream) ---
    const triggerAIResponse = useCallback(
        async (userMessage: ChatMessage, history: ChatMessage[]) => {
            if (!quizId || isTyping) return;

            console.log(
                `[AI Trigger] Triggering AI for message ${userMessage.id} in quiz ${quizId}`
            );

            // Abort any previous stream via the hook's function
            abortStream();

            const historyForApi = history.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            const modelMessageId = uuidv4();
            const modelMessagePlaceholder: ChatMessage = {
                id: modelMessageId,
                quizId: quizId,
                role: "model",
                content: "",
                createdAt: new Date(userMessage.createdAt.getTime() + 1),
                status: "waiting", // Start as waiting
            };

            setIsTyping(true); // Start loading indicator *before* API call

            try {
                // Save AI placeholder locally *before* API call
                await ChatMessageService.addOrUpdateLocalMessage(
                    modelMessagePlaceholder
                );

                // Prepare payload for the hook
                const payload = {
                    history: historyForApi,
                    latestUserMessageContent: userMessage.content,
                };

                // Start the stream using the hook
                await startStream(payload, modelMessageId);
                // NOTE: We don't await the full stream here, startStream initiates it.
                // The callbacks (handleChunkReceived, etc.) will handle updates.
            } catch (error) {
                // Errors during the *initiation* of the stream (e.g., saving placeholder)
                // Stream processing errors are handled by handleStreamError callback.
                console.error(
                    "[AI Trigger] Error setting up AI response:",
                    error
                );
                await ChatMessageService.updateLocalMessageStatus(
                    modelMessageId,
                    "error",
                    "Failed to initiate AI response"
                );
                setIsTyping(false); // Ensure typing indicator stops
            }
        },
        [quizId, isTyping, startStream, abortStream] // Add hook functions as dependencies
    );

    // --- Effect to Trigger Initial AI Response ---
    useEffect(() => {
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
            void triggerAIResponse(firstMessage, []);
        }
    }, [quizId, localMessages, isTyping, triggerAIResponse]);

    // --- handleSubmit  ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || !quizId || isTyping) return;

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
        const historyBeforeNewMessage = [...localMessages];

        try {
            await sendMessageAndUpdate(userMessage);
            // Trigger AI response using the new message and the history *before* it
            await triggerAIResponse(userMessage, historyBeforeNewMessage);
        } catch (error) {
            console.error(
                "Error saving user message or triggering AI:",
                error
            );
            // Maybe show error to user
        }
    };

    // --- JSX Rendering ---
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
                                            {/* Display the error content which was set in handleStreamError */}
                                            {message.content}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping &&
                            localMessages[localMessages.length - 1]?.role !==
                            "model" && ( // Ensure placeholder exists before showing typing
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
                    isTyping={isTyping} // Pass the component's isTyping state
                    disabled={!quizId}
                />
            </div>
        </div>
    );
}
