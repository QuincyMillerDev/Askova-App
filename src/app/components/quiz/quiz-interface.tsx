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
import { useSendChatMessage } from "~/app/hooks/useSendChatMessage"; // For sending user messages
import { v4 as uuidv4 } from "uuid";

interface QuizInterfaceProps {
    quizId: string;
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false); // Local state to manage loading indicator
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { sendMessageAndUpdate } = useSendChatMessage(); // Hook for user messages

    // Fetch messages reactively from Dexie
    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () =>
            db.chatMessages
                .where("quizId")
                .equals(quizId)
                .sortBy("createdAt"),
        [quizId]
    );

    // Memoize local messages derived from the live query
    const localMessages: ChatMessage[] = useMemo(
        () => liveMessages ?? [],
        [liveMessages]
    );

    // --- Effects ---
    useEffect(() => {
        // Component load animation effect
        setIsLoaded(false);
        const timer = setTimeout(() => setIsLoaded(true), 50);
        // Reset typing state if quiz changes
        setIsTyping(false);
        return () => clearTimeout(timer);
    }, [quizId]);

    useEffect(() => {
        // Scroll to bottom when messages change
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    // --- Function to Trigger AI Response Placeholder ---
    const triggerAIResponsePlaceholder = useCallback(
        async (userMessage: ChatMessage) => {
            console.log(
                `[Placeholder Trigger] placeholder for AI response after message ${userMessage.id} in quiz ${quizId}`
            );

            // Generate ID for the placeholder message
            const modelMessageId = uuidv4();
            const modelMessagePlaceholder: ChatMessage = {
                id: modelMessageId,
                quizId: quizId,
                role: "model",
                content: "",
                createdAt: new Date(userMessage.createdAt.getTime() + 1), // Ensure it's ordered after user msg
                status: "waiting",
            };
        },
        [quizId] // Dependencies
    );

    // --- handleSubmit for User Messages ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        // Prevent submission if input is empty, no quizId, or AI is "typing"
        if (!trimmedInput || !quizId || isTyping) return;

        // Create the user message object
        const userMessageId = uuidv4();
        const userMessage: ChatMessage = {
            id: userMessageId,
            quizId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
            status: "done", // User messages are immediately 'done' locally
        };

        setInput(""); // Clear the input field

        try {
            // Save the user message (locally via service, remotely via hook if authenticated)
            await sendMessageAndUpdate(userMessage);

            // Trigger the creation of the AI response placeholder
            // Use void as we don't need to await the placeholder creation setup
            void triggerAIResponsePlaceholder(userMessage);
        } catch (error) {
            console.error(
                "Error saving user message or triggering AI placeholder:",
                error
            );
            // TODO: Consider showing an error message to the user
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
                        {/* Display messages from localMessages */}
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
                                        // Visual cues for non-'done' statuses
                                        message.status === "waiting" &&
                                        "opacity-70 italic",
                                        message.status === "streaming" && // Keep for potential future use
                                        "opacity-90",
                                        message.status === "error" && // Keep for potential future use
                                        "bg-destructive/20 text-destructive border border-destructive"
                                    )}
                                    style={{ overflowWrap: "break-word" }}
                                >
                                    <div className="markdown">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {/* Show '...' if waiting and content is empty */}
                                            {message.status === "waiting" &&
                                            !message.content
                                                ? "..."
                                                : message.content}
                                        </ReactMarkdown>
                                    </div>
                                    {/* Keep error display logic for potential future use */}
                                    {message.status === "error" &&
                                        message.role === "model" && (
                                            <p className="text-xs mt-1 text-destructive/80">
                                                Error: {message.content}
                                            </p>
                                        )}
                                </div>
                            </div>
                        ))}

                        {/* Typing Indicator based on local isTyping state */}
                        {isTyping && (
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
                    isTyping={isTyping} // Use local isTyping state
                    disabled={!quizId || !isLoaded} // Disable input while loading/no quizId
                />
            </div>
        </div>
    );
}
