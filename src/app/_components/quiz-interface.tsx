"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { PanelLeft } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "~/trpc/react";
import { db } from "~/db/dexie";
import { type ChatMessage } from "~/types/ChatMessage";
import {QuizInput} from "~/app/_components/quiz-input";

interface QuizInterfaceProps {
    quizId: string;
    initialMessages: ChatMessage[];
    isCollapsed?: boolean;
    toggleSidebar?: () => void;
}

export function QuizInterface({
                                  quizId,
                                  initialMessages,
                                  isCollapsed,
                                  toggleSidebar,
                              }: QuizInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const { data: session } = useSession();
    const isAuthenticated = Boolean(session?.user?.id);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const addChatMessageMutation = api.quiz.addChatMessage.useMutation();

    // Auto-scroll when a new message appears.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        // Create a local message object.
        const userMessage: ChatMessage = {
            id: Date.now(), // temporary id
            sessionId: quizId,
            role: "user",
            content: trimmed,
            createdAt: new Date(),
        };

        // Update state so the message appears immediately.
        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        // Persist the message into Dexie for later synchronization.
        try {
            await db.chatMessages.add(userMessage);
        } catch (error) {
            console.error("Error saving message to Dexie:", error);
        }

        // If the user is authenticated, also send the message to the server.
        if (isAuthenticated) {
            addChatMessageMutation.mutate({ quizId, role: "user", content: trimmed });
        } else {
            console.warn("Unauthenticated state: message stored in Dexie only.");
        }

        // For demonstration: simulate a model response.
        setIsTyping(true);
        setTimeout(() => {
            const modelMessage: ChatMessage = {
                id: Date.now() + 1,
                sessionId: quizId,
                role: "model",
                content: `Echo: ${trimmed}`,
                createdAt: new Date(),
            };
            setMessages((prev) => [...prev, modelMessage]);
            setIsTyping(false);
            // Optionally store model messages in Dexie as well
            void db.chatMessages.add(modelMessage);
        }, 1000);
    };

    return (
        <div className="flex h-full w-full">
            {/* Sidebar Toggle (if provided) */}
            {toggleSidebar && (
                <div className="hidden md:flex w-10 flex-shrink-0 flex-col items-center pt-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={toggleSidebar}
                    >
                        <PanelLeft
                            className={cn(
                                "h-4 w-4 transition-transform",
                                isCollapsed && "rotate-180"
                            )}
                        />
                        <span className="sr-only">Toggle Sidebar</span>
                    </Button>
                </div>
            )}
            <div className="flex-1 relative w-full">
                <ScrollArea className="w-full h-full">
                    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-36">
                        {messages.length === 0 && (
                            <div className="text-center p-8 text-muted-foreground">
                                {isAuthenticated && session?.user?.name ? (
                                    <span>Hello {session.user.name},</span>
                                ) : (
                                    <span>Hello,</span>
                                )}
                                &nbsp;start the quiz by typing a question below.
                            </div>
                        )}
                        {messages.map((message) => (
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
                                                        style={{ overflowX: "auto", maxWidth: "100%" }}
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
                        <div ref={messagesEndRef} />
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
