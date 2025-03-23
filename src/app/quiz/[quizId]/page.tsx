// src/app/quiz/[quizId]/page.tsx
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { QuizInterface } from "../../_components/quiz/quiz-interface";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { skipToken } from "@tanstack/query-core";

export default function QuizPage() {
    // Get the quiz id from the route parameters.
    const params = useParams();
    const rawQuizId = params.quizId;
    const quizId = Array.isArray(rawQuizId) ? rawQuizId[0] : rawQuizId;

    const { data: session } = useSession();
    const isAuthenticated = Boolean(session?.user?.id);

    // Fetch persistent quiz data if the user is authenticated.
    const { data: persistentQuiz } = api.quiz.getById.useQuery(
        quizId ? { quizId } : skipToken,
        { enabled: isAuthenticated && Boolean(quizId) }
    );

    // Use the persistent quiz id if available.
    const effectiveQuizId = persistentQuiz?.id ?? quizId ?? "";

    return <QuizInterface quizId={effectiveQuizId} />;
}
