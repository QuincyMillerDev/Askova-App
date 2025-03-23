// app/_components/quiz-welcome.tsx
"use client";

import React, { useState } from "react";
import type { ChangeEvent } from "react";
import { QuizInput } from "./quiz-input";
import { Card, CardContent, CardHeader, CardTitle } from "~/app/_components/ui/card";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { db } from "~/db/dexie";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import type { Quiz } from "~/types/Quiz";
import type { ChatMessage } from "~/types/ChatMessage";

export function QuizWelcome() {
    const [inputValue, setInputValue] = useState("");
    const router = useRouter();
    const { data: session } = useSession();

    // tRPC mutation to create a new quiz session on the server.
    const createQuizMutation = api.quiz.create.useMutation();

    const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = inputValue.trim();
        if (!trimmedInput) return;

        // 1. Generate a new quiz session ID.
        const quizId = uuidv4();

        // 2. Build an initial chat message.
        const initialMessage: ChatMessage = {
            id: Date.now(), // Use a temporary id for local display (Dexie auto-generates real IDs if needed)
            sessionId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
        };

        // 3. Build a quiz session object (to be stored in Dexie).
        const newQuiz: Quiz = {
            id: quizId,
            title: trimmedInput,
            messages: [], // Initially empty (we’re storing messages separately)
            userId: session?.user?.id ?? undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        try {
            // Save the new quiz session to Dexie.
            await db.quizzes.put(newQuiz);
            // Also store the initial chat message to Dexie.
            await db.chatMessages.add(initialMessage);
        } catch (error) {
            console.error("Failed to create quiz session locally:", error);
            return;
        }

        // 4. If the user is authenticated, also persist the quiz session on the server.
        if (session?.user) {
            try {
                await createQuizMutation.mutateAsync({ id: quizId, title: trimmedInput });
            } catch (error) {
                console.error("Error persisting quiz session on server:", error);
                // Optionally, you could display a nonblocking error message to the user.
            }
        }

        // 5. Navigate to the quiz page.
        router.push(`/quiz/${quizId}`);
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] w-full px-4">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        Welcome to Your Study Session
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-center text-muted-foreground">
                        Get started by entering your study topic or uploading your notes below.
                    </p>
                    <QuizInput
                        input={inputValue}
                        onInputChange={handleInputChange}
                        onSubmit={handleSubmit}
                        isTyping={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
