// src/app/_components/quiz-interface.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Send, PanelLeft, Paperclip } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "~/trpc/react";
import {type ChatMessage} from "~/types/ChatMessage";

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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const addChatMessageMutation = api.quiz.addChatMessage.useMutation();


    // Auto-scroll when a new message appears
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        const userMessage: ChatMessage = {
            id: Date.now(), // temporary id; replace with real id if available
            sessionId: quizId,
            role: "user",
            content: trimmed,
            createdAt: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        addChatMessageMutation.mutate({
            quizId,
            role: "user",
            content: trimmed,
        });

        // For demonstration purposes: simulate a model response.
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
            // Optionally, persist the model response via tRPC.
            setIsTyping(false);
        }, 1000);
    };

    const emptyState = (
        <div className="text-center p-8 text-muted-foreground">
            {session?.user?.name ? (
                <span>Hello {session.user.name},</span>
            ) : (
                <span>Hello,</span>
            )}{" "}
            start the quiz by typing a question below.
        </div>
    );

    return (
        <div className="flex h-full w-full">
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
                        {messages.length === 0 && emptyState}
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
                                            : "bg-muted text-muted-foreground",
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

                <div className="mx-auto max-w-4xl absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="bg-background/80 backdrop-blur-md rounded-2xl shadow-lg border border-border/40">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder="Type your answer..."
                                className="w-full border-0 pr-20 pl-4 py-3 text-base rounded-2xl resize-none"
                                style={{ minHeight: "100px" }}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute left-3 bottom-3 text-muted-foreground"
                                aria-label="Attach files"
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <Button
                                type="submit"
                                disabled={!input.trim() || isTyping}
                                className="absolute right-4 bottom-4 p-2 rounded-full bg-primary hover:bg-primary/90"
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
