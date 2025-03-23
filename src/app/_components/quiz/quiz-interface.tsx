// src/app/_components/quiz-interface.tsx
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
import { db } from "~/db/dexie";
import type { ChatMessage } from "~/types/ChatMessage";
import { QuizInput } from "~/app/_components/quiz/quiz-input";
import { useLiveQuery } from "dexie-react-hooks";
import { useSync } from "~/hooks/useSync";

interface QuizInterfaceProps {
    quizId: string;
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { addChatMessageSync } = useSync();

    // Use Dexie Live Query to always read all messages for this session.
    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () => db.chatMessages.where("quizId").equals(quizId).toArray(),
        [quizId]
    );

    // Wrap initialization of localMessages in its own useMemo().
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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        // Create a new user message.
        const userMessage: ChatMessage = {
            id: Date.now(), // temporary local id
            quizId: quizId,
            role: "user",
            content: trimmed,
            createdAt: new Date(),
        };

        try {
            await addChatMessageSync(userMessage);
            setInput("");

            // Trigger echo simulation for the new message.
            if (!isTyping) {
                setIsTyping(true);
                setTimeout(() => {
                    const modelMessage: ChatMessage = {
                        id: Date.now() + 1,
                        quizId: quizId,
                        role: "model",
                        content: `Echo: ${trimmed}`,
                        createdAt: new Date(),
                    };
                    void addChatMessageSync(modelMessage);
                    setIsTyping(false);
                }, 1000);
            }
        } catch (error) {
            console.error("Error handling message:", error);
            // Handle error appropriately
        }
    };

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 relative w-full">
                <ScrollArea className="w-full h-full">
                    {/* The content container transitions opacity over 300ms */}
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
                                        "rounded-lg p-4",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "",
                                        "max-w-full"
                                    )}
                                    style={{ overflowWrap: "anywhere" }}
                                >
                                    <div
                                        className="markdown prose-sm dark:prose-invert"
                                        style={{ wordBreak: "break-word" }}
                                    >
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                pre: (props) => (
                                                    <pre
                                                        style={{
                                                            overflowX: "auto",
                                                            maxWidth: "100%",
                                                        }}
                                                        {...props}
                                                    />
                                                ),
                                                code: (props) => (
                                                    <code
                                                        style={{
                                                            overflowWrap: "break-word",
                                                            whiteSpace: "pre-wrap",
                                                        }}
                                                        {...props}
                                                    />
                                                ),
                                                p: (props) => <p {...props} />,
                                                a: (props) => <a {...props} />,
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                                    <div className="flex space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-75" />
                                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-150" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef}></div>
                    </div>
                </ScrollArea>
                <QuizInput
                    input={input}
                    onInputChange={(e) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    isTyping={isTyping}
                />
            </div>
        </div>
    );
}
