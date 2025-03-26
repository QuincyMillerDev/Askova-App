"use client";

import type React from "react";
import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { QuizInput } from "./quiz-input";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { useCreateQuiz } from "~/app/hooks/useCreateQuiz";
import { Button } from "~/app/components/ui/button";
import {type ChatMessage, type Quiz} from "~/db/dexie";

export function QuizWelcome() {
    const [inputValue, setInputValue] = useState("");
    const [isLoaded, setIsLoaded] = useState(false);
    const router = useRouter();
    const { createQuiz } = useCreateQuiz();

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = inputValue.trim();
        if (!trimmedInput) return;

        const quizId = uuidv4();
        const chatMessageId: string = uuidv4();

        const newMessage: ChatMessage = {
            id: chatMessageId,
            quizId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
            status: "done"
        };

        const newQuiz: Quiz = {
            id: quizId,
            title: trimmedInput,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessageAt: new Date(),
            status: "done",
        };

        try {
            await createQuiz(newQuiz, newMessage);
            router.push(`/quiz/${quizId}`);
        } catch (error) {
            console.error("Failed to create quiz:", error);
        }
    };

    const examplePrompts = [
        "Quiz me on my biology notes",
        "Create questions about my history lecture",
    ];

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 relative w-full">
                <div className="flex items-center justify-center h-full">
                    <div
                        className={`mx-auto max-w-xl px-4 pb-36 transition-opacity duration-500 ease-out ${
                            isLoaded ? "opacity-100" : "opacity-0"
                        }`}
                        style={{ maxWidth: "800px" }}
                    >
                        {/* Heading */}
                        <h1
                            className={`text-3xl font-bold text-left mb-3 transition-transform duration-500 ease-out delay-100 ${
                                isLoaded ? "translate-y-0" : "translate-y-4"
                            }`}
                        >
                            Study Smarter with <span className="text-primary">Askova</span>
                        </h1>

                        {/* Primary Action Description */}
                        <div
                            className={`text-left mb-8 transition-transform duration-500 ease-out delay-200 ${
                                isLoaded ? "translate-y-0" : "translate-y-4"
                            }`}
                        >
                            <p className="text-lg mb-2">Paste your study notes below to begin</p>
                            <p className="text-sm text-muted-foreground">
                                Upload your lecture notes, textbook chapters, or study materials
                                to generate an interactive quiz conversation
                            </p>
                        </div>

                        {/* New Styled Upload Section */}
                        <div
                            className={`flex justify-start mb-10 transition-transform duration-500 ease-out delay-300 ${
                                isLoaded ? "translate-y-0" : "translate-y-4"
                            }`}
                        >
                            <Button variant="secondary">Upload Notes</Button>
                        </div>

                        {/* Example Prompts - Secondary */}
                        <div
                            className={`text-left transition-opacity duration-500 ease-out delay-400 ${
                                isLoaded ? "opacity-100" : "opacity-0"
                            }`}
                        >
                            <p className="text-sm text-muted-foreground mb-4">Or try:</p>
                            <div className="flex flex-col gap-3">
                                {examplePrompts.map((prompt, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        className="rounded-md bg-secondary/10 hover:bg-secondary/20 border-secondary/20 justify-start"
                                        onClick={() => {
                                            setInputValue(prompt);
                                            const inputElement = document.querySelector("textarea");
                                            if (inputElement) inputElement.focus();
                                        }}
                                    >
                                        {prompt}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <QuizInput
                    input={inputValue}
                    onInputChange={handleInputChange}
                    onSubmit={handleSubmit}
                    isTyping={false}
                />
            </div>
        </div>
    );
}
