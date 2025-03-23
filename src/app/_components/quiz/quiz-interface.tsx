// src/app/_components/quiz-interface.tsx
"use client";

import React, {
    useState,
    useRef,
    useEffect,
    useMemo,
    type FormEvent,
} from "react";
import { useSession } from "next-auth/react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "~/trpc/react";
import { db } from "~/db/dexie";
import type { ChatMessage, ChatRole } from "~/types/ChatMessage";
import { QuizInput } from "~/app/_components/quiz/quiz-input";
import { useLiveQuery } from "dexie-react-hooks";

interface QuizInterfaceProps {
    quizId: string;
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    // Use Dexie Live Query to always read all messages for this session.
    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () => db.chatMessages.where("sessionId").equals(quizId).toArray(),
        [quizId]
    );

    // Wrap initialization of localMessages in its own useMemo().
    const localMessages: ChatMessage[] = useMemo(
        () => liveMessages ?? [],
        [liveMessages]
    );

    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const { data: session } = useSession();
    const isAuthenticated = Boolean(session?.user?.id);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // State to control the opacity animation
    const [isLoaded, setIsLoaded] = useState(false);

    // Trigger a fade-in transition when quizId changes.
    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, 50); // small delay to trigger the transition
        return () => clearTimeout(timer);
    }, [quizId]);

    // tRPC mutation to send a new chat message.
    const addChatMessageMutation = api.quiz.addChatMessage.useMutation();

    // Auto-scroll when messages update.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [localMessages]);

    // Effect to simulate an echo for the last user message if not already echoed.
    useEffect(() => {
        if (localMessages.length > 0) {
            const lastMessage = localMessages[localMessages.length - 1]!;
            if (lastMessage.role === "user") {
                const echoExists = localMessages.some(
                    (msg) =>
                        msg.role === "model" &&
                        msg.createdAt > lastMessage.createdAt &&
                        msg.content.includes("Echo:")
                );
                if (!echoExists) {
                    const timeoutId = setTimeout(() => {
                        const modelMessage: ChatMessage = {
                            id: Date.now() + 1, // temporary id
                            sessionId: quizId,
                            role: "model",
                            content: `Echo: ${lastMessage.content}`,
                            createdAt: new Date(),
                        };
                        void db.chatMessages.add(modelMessage);
                    }, 1000);
                    return () => clearTimeout(timeoutId);
                }
            }
        }
    }, [localMessages, quizId]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        // Create a new user message.
        const userMessage: ChatMessage = {
            id: Date.now(), // temporary local id
            sessionId: quizId,
            role: "user",
            content: trimmed,
            createdAt: new Date(),
        };

        try {
            await db.chatMessages.add(userMessage);
        } catch (error) {
            console.error("Error saving message to Dexie:", error);
        }

        // If authenticated, send the message via tRPC.
        if (isAuthenticated) {
            try {
                addChatMessageMutation.mutate({
                    quizId,
                    role: "user" as ChatRole,
                    content: trimmed,
                });
            } catch (error) {
                console.error("Error persisting message via tRPC:", error);
            }
        } else {
            console.warn("Unauthenticated; message stored locally only.");
        }

        setInput("");

        // Trigger echo simulation for the new message.
        if (!isTyping) {
            setIsTyping(true);
            setTimeout(() => {
                const modelMessage: ChatMessage = {
                    id: Date.now() + 1,
                    sessionId: quizId,
                    role: "model",
                    content: `Echo: ${trimmed}`,
                    createdAt: new Date(),
                };
                void db.chatMessages.add(modelMessage);
                setIsTyping(false);
            }, 1000);
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
