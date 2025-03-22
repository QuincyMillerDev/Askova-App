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

export default function QuizPageClient({ quizId, isCollapsed, toggleSidebar }: QuizPageClientProps) {
    const { data: session } = useSession();
    const isAuthenticated = Boolean(session?.user?.id);

    // Only fetch persistent quiz data when the user is authenticated.
    const { data: persistentQuiz, isLoading } = api.quiz.getById.useQuery(
        { quizId },
        { enabled: isAuthenticated }
    );

    // If authenticated, show persistent data (or loading/error states).
    if (isAuthenticated) {
        if (isLoading) return <div>Loading quiz session…</div>;
        if (!persistentQuiz) return <div>Quiz session not found.</div>;

        return (
            <QuizInterface
                // Use the ID returned from persistent storage.
                quizId={persistentQuiz.id}
                initialMessages={persistentQuiz.messages.map((msg) => ({
                    id: msg.id,
                    role: msg.role as "user" | "model",
                    content: msg.content,
                    sessionId: persistentQuiz.id,
                    createdAt: msg.createdAt,
                }))}
                isCollapsed={isCollapsed}
                toggleSidebar={toggleSidebar}
            />
        );
    }

    // Otherwise, render ephemeral mode: use the URL quizId and no preloaded messages.
    return <QuizInterface quizId={quizId} initialMessages={[]} isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />;
}
