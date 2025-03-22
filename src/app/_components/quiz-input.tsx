// src/app/_components/quiz-input.tsx
"use client";

import React from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Paperclip, Send } from "lucide-react";

interface QuizInputProps {
    input: string;
    onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
    onSubmit: (e: React.FormEvent) => void;
    isTyping: boolean;
    disabled?: boolean;
}

export function QuizInput({
                              input,
                              onInputChange,
                              onSubmit,
                              isTyping,
                              disabled,
                          }: QuizInputProps) {
    return (
        <div className="mx-auto max-w-4xl absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
            <form onSubmit={onSubmit} className="relative">
                <div
                    className="bg-background/80 md:backdrop-blur-md rounded-2xl shadow-lg border border-border/40"
                >
                    <Textarea
                        value={input}
                        onChange={onInputChange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                onSubmit(e);
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
                        className="absolute left-3 bottom-3 text-muted-foreground hover:text-foreground"
                        aria-label="Attach files"
                    >
                        <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button
                        type="submit"
                        disabled={!input.trim() || isTyping || disabled}
                        className="absolute right-4 bottom-4 p-2 rounded-full bg-primary hover:bg-primary/90"
                    >
                        <Send className="h-5 w-5" />
                    </Button>
                </div>
            </form>
        </div>
    );
}
