// src/app/components/quiz/quiz-interface.tsx
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
import { useSendChatMessage } from "~/app/hooks/useSendChatMessage"; // For user message sync
import { v4 as uuidv4 } from "uuid";
import { api } from "~/trpc/react";
import { ChatMessageService } from "~/services/chatMessageService";
import { QuizService } from "~/services/quizService";
import syncService from "~/services/syncService";

interface QuizInterfaceProps {
    quizId: string;
}

// No longer need TRPCSubscription type or currentSubscription ref

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- State for triggering the subscription ---
    const [subscriptionInput, setSubscriptionInput] = useState<{
        quizId: string;
        latestUserMessageContent: string;
    } | null>(null);
    const [shouldSubscribe, setShouldSubscribe] = useState(false);
    const currentAiMessageIdRef = useRef<string | null>(null); // Ref to hold the ID for the current stream

    // Hook for saving user message locally + triggering background sync
    const { sendMessageAndUpdate } = useSendChatMessage();

    // Live query for messages
    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () =>
            db.chatMessages
                .where("quizId")
                .equals(quizId)
                .sortBy("createdAt"),
        [quizId],
        [] // Initial empty array
    );

    // Memoize localMessages and determine if AI is processing
    const { localMessages, isAiProcessing } = useMemo(() => {
        const messages = liveMessages ?? [];
        // Check for 'waiting' or 'streaming' status specifically for the *model* role
        const processing = messages.some(
            (m) =>
                m.role === "model" &&
                (m.status === "waiting" || m.status === "streaming")
        );
        return { localMessages: messages, isAiProcessing: processing };
    }, [liveMessages]);

    // Fade-in effect
    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => setIsLoaded(true), 50);
        return () => clearTimeout(timer);
    }, [quizId]);

    // Auto-scroll effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]); // Trigger scroll on message changes

    // --- tRPC Subscription Hook ---
    api.llm.generateResponseStream.useSubscription(
        subscriptionInput ?? { quizId: "", latestUserMessageContent: "" },
        {
            enabled: shouldSubscribe && !!subscriptionInput,
            onData: (chunk) => {
                // Wrap async logic in an IIFE
                (async () => {
                    const aiMessageId = currentAiMessageIdRef.current;
                    if (!aiMessageId) {
                        console.warn(
                            "[useSubscription onData IIFE] No active AI message ID."
                        );
                        return;
                    }
                    // console.log("Stream chunk:", chunk);
                    try {
                        // Append content and update status to streaming
                        await ChatMessageService.appendLocalMessageContent(
                            aiMessageId,
                            "streaming",
                            chunk
                        );
                        // Update quiz status locally
                        await QuizService.updateLocalQuizStatus(
                            quizId,
                            "waiting"
                        );
                    } catch (error) {
                        // Handle errors specifically from the async operations
                        console.error(
                            "[useSubscription onData IIFE] Error handling stream data:",
                            error
                        );
                        // Optionally update status to error here if needed,
                        // though onError might handle the overall stream failure.
                    }
                })().catch((err) => {
                    // Catch errors from the IIFE promise itself (e.g., if the function setup fails)
                    // This is less likely but good practice.
                    console.error(
                        "[useSubscription onData IIFE] Uncaught error:",
                        err
                    );
                });
            },
            onComplete: () => {
                // Wrap async logic in an IIFE
                (async () => {
                    console.log("[useSubscription] Stream complete.");
                    const aiMessageId = currentAiMessageIdRef.current;
                    if (!aiMessageId) {
                        console.warn(
                            "[useSubscription onComplete IIFE] No active AI message ID."
                        );
                        // Ensure cleanup happens even if ID is missing somehow
                        setShouldSubscribe(false);
                        setSubscriptionInput(null);
                        currentAiMessageIdRef.current = null;
                        return;
                    }
                    try {
                        // Final status update for AI message
                        await ChatMessageService.updateLocalMessageStatus(
                            aiMessageId,
                            "done"
                        );
                        // Update quiz status locally
                        await QuizService.updateLocalQuizStatus(quizId, "done");

                        // Fetch the final message to sync
                        const finalAiMessage =
                            await ChatMessageService.getLocalMessageById(
                                aiMessageId
                            );
                        if (finalAiMessage) {
                            // Sync the *completed* AI message to backend
                            // Fire-and-forget sync, but catch errors
                            syncService
                                .uploadChatMessage(finalAiMessage)
                                .catch((err) => {
                                    console.error(
                                        `[useSubscription onComplete IIFE] Failed to sync completed AI message ${aiMessageId}:`,
                                        err
                                    );
                                });
                        } else {
                            console.warn(
                                `[useSubscription onComplete IIFE] Could not find final AI message ${aiMessageId} to sync.`
                            );
                        }
                    } catch (error) {
                        console.error(
                            "[useSubscription onComplete IIFE] Error handling stream completion:",
                            error
                        );
                    } finally {
                        // Cleanup happens regardless of success/error within the try block
                        setShouldSubscribe(false);
                        setSubscriptionInput(null);
                        currentAiMessageIdRef.current = null;
                    }
                })().catch((err) => {
                    console.error(
                        "[useSubscription onComplete IIFE] Uncaught error:",
                        err
                    );
                    // Ensure cleanup happens even if the IIFE itself fails
                    setShouldSubscribe(false);
                    setSubscriptionInput(null);
                    currentAiMessageIdRef.current = null;
                });
            },
            onError: (err) => {
                // Wrap async logic in an IIFE
                (async () => {
                    console.error("[useSubscription] Stream error:", err);
                    const aiMessageId = currentAiMessageIdRef.current;
                    if (!aiMessageId) {
                        console.warn(
                            "[useSubscription onError IIFE] No active AI message ID."
                        );
                        // Ensure cleanup happens even if ID is missing somehow
                        setShouldSubscribe(false);
                        setSubscriptionInput(null);
                        currentAiMessageIdRef.current = null;
                        return;
                    }
                    try {
                        // Update local AI message status and content with error
                        await ChatMessageService.updateLocalMessageStatus(
                            aiMessageId,
                            "error",
                            `Error generating response: ${err.message}`
                        );
                        // Update quiz status locally
                        await QuizService.updateLocalQuizStatus(quizId, "error");
                    } catch (error) {
                        console.error(
                            "[useSubscription onError IIFE] Error handling stream error state:",
                            error
                        );
                    } finally {
                        // Cleanup happens regardless of success/error within the try block
                        setShouldSubscribe(false);
                        setSubscriptionInput(null);
                        currentAiMessageIdRef.current = null;
                    }
                })().catch((iifeErr) => {
                    console.error(
                        "[useSubscription onError IIFE] Uncaught error:",
                        iifeErr
                    );
                    // Ensure cleanup happens even if the IIFE itself fails
                    setShouldSubscribe(false);
                    setSubscriptionInput(null);
                    currentAiMessageIdRef.current = null;
                });
            },
        }
    );

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            const trimmedInput = input.trim();
            // Prevent sending if AI is busy, no input, or already trying to subscribe
            if (!trimmedInput || !quizId || isAiProcessing || shouldSubscribe)
                return;

            // --- 1. Save User Message ---
            const userMessageId = uuidv4();
            const userMessage: ChatMessage = {
                id: userMessageId,
                quizId: quizId,
                role: "user",
                content: trimmedInput,
                createdAt: new Date(),
                status: "done",
            };
            setInput(""); // Clear input immediately

            try {
                await sendMessageAndUpdate(userMessage); // Save locally & trigger background sync
            } catch (error) {
                console.error("Error saving user message:", error);
                setInput(trimmedInput); // Restore input on error
                // TODO: Show user-facing error
                return;
            }

            // --- 2. Create AI Placeholder & Update Quiz Status ---
            const aiMessageId = uuidv4();
            currentAiMessageIdRef.current = aiMessageId; // Store the ID for the subscription callbacks
            const aiPlaceholderMessage: ChatMessage = {
                id: aiMessageId,
                quizId: quizId,
                role: "model",
                content: "", // Start empty
                createdAt: new Date(), // Use current time
                status: "waiting",
            };

            try {
                // Save placeholder locally (DOES NOT SYNC YET)
                await ChatMessageService.addOrUpdateLocalMessage(aiPlaceholderMessage);
                // Update quiz status locally
                await QuizService.updateLocalQuizStatus(quizId, "waiting");
            } catch (error) {
                console.error(
                    "Error creating AI placeholder/updating quiz status:",
                    error
                );
                currentAiMessageIdRef.current = null; // Clear ref on error
                // TODO: Show user-facing error, maybe delete placeholder?
                return;
            }

            // --- 3. Trigger the tRPC Subscription Hook ---
            console.log(
                `[QuizInterface] Triggering subscription for quiz ${quizId}`
            );
            setSubscriptionInput({
                quizId: quizId,
                latestUserMessageContent: trimmedInput,
            });
            setShouldSubscribe(true); // This will enable the useSubscription hook on the next render
        },
        [quizId, input, isAiProcessing, sendMessageAndUpdate, shouldSubscribe] // Add shouldSubscribe dependency
    );

    // --- Rendering Logic (No changes needed below this line) ---
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
                                key={message.id} // Use unique ID
                                className={`flex ${
                                    message.role === "user"
                                        ? "justify-end"
                                        : "justify-start"
                                }`}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-lg p-3 md:p-4 shadow-sm",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground",
                                        // Add visual cues for message status
                                        message.status === "error" &&
                                        "border border-destructive bg-destructive/10 text-destructive-foreground",
                                        (message.status === "waiting" ||
                                            message.status === "streaming") &&
                                        "opacity-80" // Slight fade while processing
                                    )}
                                    style={{ overflowWrap: "break-word" }}
                                >
                                    {/* Render Markdown Content */}
                                    <div className="markdown">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                    {/* Optional: Add explicit status indicators */}
                                    {(message.status === "waiting" ||
                                            message.status === "streaming") &&
                                        message.role === "model" && (
                                            <div className="mt-2 flex justify-center">
                                                <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
                                                <div className="ml-1 h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
                                                <div className="ml-1 h-2 w-2 animate-bounce rounded-full bg-current opacity-60" />
                                            </div>
                                        )}
                                    {message.status === "error" &&
                                        message.role === "model" && (
                                            <p className="mt-1 text-xs text-destructive">
                                                Failed to generate response.
                                            </p>
                                        )}
                                </div>
                            </div>
                        ))}
                        {/* Empty div for scrolling */}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
                <QuizInput
                    input={input}
                    onInputChange={(e) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    isTyping={isAiProcessing} // Use isAiProcessing to indicate busy state
                    disabled={!quizId || isAiProcessing || shouldSubscribe} // Also disable while trying to subscribe
                />
            </div>
        </div>
    );
}
