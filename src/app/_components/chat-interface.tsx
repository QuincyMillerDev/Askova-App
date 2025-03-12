// _components/chat-interface.tsx
"use client";

import React, { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Send, PanelLeft, Paperclip } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatInterfaceProps {
    messages: { id: string; role: "user" | "assistant"; content: string }[];
    input: string;
    isTyping: boolean;
    onInputChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isEmpty: boolean;
    emptyState?: ReactNode;
    modalContent?: ReactNode;
    isCollapsed?: boolean;
    toggleSidebar?: () => void;
}

export function ChatInterface({
                                  messages,
                                  input,
                                  isTyping,
                                  onInputChange,
                                  onSubmit,
                                  isEmpty,
                                  emptyState,
                                  modalContent,
                                  isCollapsed,
                                  toggleSidebar,
                              }: ChatInterfaceProps) {
    // Ref to track the end of the messages for auto-scrolling
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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

            {/* Outer Chat Container (full width) */}
            <div className="flex-1 relative w-full">
                {/* Scroll Area spans full width */}
                <ScrollArea className="w-full h-full">
                    {/* Centered Content Container: Limits the chat messages to a max-width */}
                    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-36">
                        {isEmpty && emptyState}
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
                                            ? "bg-primary text-primary-foreground" : "",
                                        "max-w-full"
                                    )}
                                    style={{ overflowWrap: "anywhere" }}
                                >
                                    <div
                                        className="markdown prose-sm dark:prose-invert"
                                        style={{
                                            wordBreak: "break-word",
                                            overflowWrap: "break-word",
                                        }}
                                    >
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                pre: (props) => (
                                                    <pre style={{ overflowX: "auto", maxWidth: "100%" }} {...props} />
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
                                                p: (props) => (
                                                    <p style={{ overflowWrap: "break-word" }} {...props} />
                                                ),
                                                a: (props) => (
                                                    <a style={{ wordBreak: "break-all" }} {...props} />
                                                ),
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

                        {/* Auto-scroll anchor */}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Floating Input Area (full width) */}
                <div className="mx-auto max-w-4xl absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
                    <form onSubmit={onSubmit} className="relative">
                        <div className="bg-background/80 backdrop-blur-md rounded-2xl shadow-lg border border-border/40">
                            <Textarea
                                value={input}
                                onChange={(e) => onInputChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        onSubmit(e);
                                    }
                                }}
                                placeholder="Type your answer..."
                                className="w-full border-0 pr-20 pl-4 py-3 text-base rounded-2xl resize-none shadow-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground bg-transparent"
                                style={{ minHeight: "100px" }}
                            />
                            {/* File upload button */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute left-3 bottom-3 text-muted-foreground hover:text-foreground"
                                aria-label="Attach files"
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            {/* Send button */}
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

                {modalContent}
            </div>
        </div>
    );
}
