// src/app/quiz/[quizId]/quiz-page-client.tsx
"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { QuizInterface } from "~/app/_components/quiz-interface";

interface QuizPageClientProps {
    quizId: number;
}

export default function QuizPageClient({ quizId }: QuizPageClientProps) {
    const { data: session } = useSession();

    // Only fetch from the backend if the user is authenticated.
    const { data: quiz, isLoading } = api.quiz.getById.useQuery(
        { quizId },
        { enabled: !!session } // disable the query if there's no session
    );

    if (session) {
        // Authenticated: use persistent data from Prisma.
        if (isLoading) {
            return <div>Loading quiz session…</div>;
        }
        if (!quiz) {
            return <div>Quiz session not found.</div>;
        }
        // TODO: Fix whats happening here. It has to do with rendering based on if we're authenticated or not. Look at line 19
        return (
            <QuizInterface
                quizId={quiz.id.toString()}
                initialMessages={quiz.messages.map((msg) => ({
                    id: msg.id.toString(),
                    role: msg.role as "user" | "model",
                    content: msg.content,
                }))}
            />
        );
    } else {
        // Unauthenticated (ephemeral): simply use the quizId and start with empty messages.
        return <QuizInterface quizId={quizId} initialMessages={[]} />;
    }
}
