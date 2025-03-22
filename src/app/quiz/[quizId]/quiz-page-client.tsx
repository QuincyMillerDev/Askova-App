"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { QuizInterface } from "~/app/_components/quiz-interface";

interface QuizPageClientProps {
    quizId: string;
    isCollapsed?: boolean;
    toggleSidebar: () => void;
}

export default function QuizPageClient({
                                           quizId,
                                           isCollapsed,
                                           toggleSidebar,
                                       }: QuizPageClientProps) {
    const { data: session } = useSession();
    const isAuthenticated = Boolean(session?.user?.id);

    // Only fetch persistent quiz data when authenticated.
    const { data: persistentQuiz } = api.quiz.getById.useQuery(
        { quizId },
        { enabled: isAuthenticated }
    );

    // When persistentQuiz is not loaded (or not found), fall back to ephemeral mode.
    // This avoids showing "Loading..." or "Quiz session not found" messages.
    const effectiveQuizId = persistentQuiz?.id ?? quizId;
    const initialMessages =
        persistentQuiz?.messages
            ? persistentQuiz.messages.map((msg) => ({
                id: msg.id,
                role: msg.role as "user" | "model",
                content: msg.content,
                sessionId: persistentQuiz.id,
                createdAt: msg.createdAt,
            }))
            : [];

    return (
        <QuizInterface
            quizId={effectiveQuizId}
            initialMessages={initialMessages}
            isCollapsed={isCollapsed}
            toggleSidebar={toggleSidebar}
        />
    );
}
