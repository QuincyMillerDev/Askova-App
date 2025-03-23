"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { QuizInterface } from "../../_components/quiz/quiz-interface";
import { QuizSidebar } from "../../_components/quiz/quiz-sidebar";
import { QuizLayout } from "../../_components/quiz/quiz-layout";
import { QuizSidebarToggleButton } from "~/app/_components/quiz/quiz-sidebar-toggle";
import { api } from "~/trpc/react";
import { skipToken } from "@tanstack/query-core";
import {SidebarProvider} from "~/app/_components/contexts/sidebar-context";

export default function QuizPage() {
    // Get raw quizId which may be string or string[]
    const params = useParams();
    const rawQuizId = params.quizId;
    // Normalize to a string (if arrayed, take the first element)
    const quizId: string | undefined = rawQuizId
        ? Array.isArray(rawQuizId)
            ? rawQuizId[0]
            : rawQuizId
        : undefined;

    const { data: session } = useSession();
    const isAuthenticated = Boolean(session?.user?.id);

    // Execute the tRPC query only if quizId is defined
    const { data: persistentQuiz } = api.quiz.getById.useQuery(
        quizId ? { quizId } : skipToken,
        { enabled: isAuthenticated && Boolean(quizId) }
    );

    // Use persistent data if available; otherwise use the route parameter and an empty array.
    const effectiveQuizId = persistentQuiz?.id ?? quizId ?? "";

    return (
        <SidebarProvider>
            <main>
                <QuizSidebarToggleButton />
                <QuizLayout
                    sidebar={<QuizSidebar />}
                    content={
                        <QuizInterface quizId={effectiveQuizId} />
                    }
                />
            </main>
        </SidebarProvider>
    );
}
