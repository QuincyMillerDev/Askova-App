// src/app/components/quiz-interface.tsx
"use client";

import React, {
    useState,
    useRef,
    useEffect,
    useMemo,
    type FormEvent,
} from "react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db, type ChatMessage } from "~/db/dexie"; // Import ChatMessage type from dexie
import { QuizInput } from "~/app/components/quiz/quiz-input";
import { useLiveQuery } from "dexie-react-hooks";
import { useSendChatMessage } from "~/app/hooks/useSendChatMessage";
import { v4 as uuidv4 } from "uuid"; // Import uuid

interface QuizInterfaceProps {
    quizId: string;
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    // isTyping might be repurposed later for actual AI response indication
    const [isTyping, setIsTyping] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // Use the correct function name from the hook
    const { sendMessageAndUpdate } = useSendChatMessage();

    // Use Dexie Live Query to always read all messages for this session.
    // Ensure the query fetches messages ordered by creation time for display
    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () =>
            db.chatMessages
                .where("quizId")
                .equals(quizId)
                .sortBy("createdAt"), // Sort by createdAt
        [quizId] // Dependency array includes quizId
    );

    // Memoize localMessages based on liveMessages
    const localMessages: ChatMessage[] = useMemo(
        () => liveMessages ?? [],
        [liveMessages]
    );

    // Trigger a fade-in transition when quizId changes.
    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, 50); // small delay to trigger the transition
        return () => clearTimeout(timer);
    }, [quizId]);

    // Auto-scroll when messages update.
    useEffect(() => {
        // Scroll to bottom when new messages are added or component loads
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]); // Trigger scroll on message changes

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || !quizId) return; // Ensure quizId is also present

        // Generate a unique ID for the new message
        const messageId = uuidv4();

        // Create a new user message conforming to the Dexie ChatMessage type
        const userMessage: ChatMessage = {
            id: messageId,
            quizId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
            status: "done", // Set initial status (can be updated later for streaming/sync)
        };

        // Clear input immediately for better UX
        setInput("");

        try {
            // Call the hook function to save locally and trigger background sync
            await sendMessageAndUpdate(userMessage);

            // --- Placeholder for AI Interaction ---
            // TODO: Replace this section with actual AI call
            // 1. Set isTyping(true)
            // 2. Make API call to your LLM endpoint (passing userMessage.content, quizId, history etc.)
            // 3. Handle streaming response:
            //    - Create a placeholder model message locally (e.g., status: 'waiting' or 'streaming')
            //    - Update the placeholder message content as chunks arrive
            //    - Update status to 'done' when streaming finishes
            // 4. Handle non-streaming response:
            //    - Create the model message locally once response is received (status: 'done')
            // 5. Call `sendMessage` for the model's response to save it locally and sync
            // 6. Set isTyping(false)
            // Example (Conceptual - Non-streaming):
            /*
                  setIsTyping(true);
                  // Simulate API call delay
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  const modelResponse: ChatMessage = {
                      id: uuidv4(),
                      quizId: quizId,
                      role: "model",
                      content: `AI response to: "${trimmedInput}"`,
                      createdAt: new Date(),
                      status: "done",
                  };
                  await sendMessage(modelResponse);
                  setIsTyping(false);
                  */
            // --- End Placeholder ---
        } catch (error) {
            console.error("Error sending message:", error);
            // TODO: Provide user feedback about the error
            // Maybe add the message back to the input?
            // setInput(trimmedInput); // Or display an error message component
        }
    };

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 relative w-full">
                <ScrollArea className="h-full w-full">
                    {/* The content container transitions opacity over 300ms */}
                    <div
                        className={cn(
                            "mx-auto max-w-4xl space-y-4 p-4 pb-36 transition-opacity duration-150",
                            isLoaded ? "opacity-100" : "opacity-0"
                        )}
                    >
                        {localMessages.map((message) => (
                            <div
                                // Use message.id which is now a UUID string
                                key={message.id}
                                className={`flex ${
                                    message.role === "user" ? "justify-end" : "justify-start"
                                }`}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-lg p-3 md:p-4", // Adjusted padding slightly
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground", // Use muted for model messages
                                        "shadow-sm" // Add subtle shadow
                                    )}
                                    style={{ overflowWrap: "break-word" }} // Use break-word for better wrapping
                                >
                                    {/* Apply markdown styling defined in globals.css */}
                                    <div className="markdown">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Typing indicator can be used for actual AI response generation */}
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
                        {/* Empty div to ensure scroll area scrolls to the bottom */}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
                <QuizInput
                    input={input}
                    onInputChange={(e) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    // Disable input while waiting for AI response (if isTyping is used for that)
                    isTyping={isTyping}
                    disabled={!quizId} // Disable if quizId isn't available
                />
            </div>
        </div>
    );
}