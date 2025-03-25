// src/hooks/useCreateQuiz.ts
import {type Quiz} from "~/db/dexie";
import { useSession } from "next-auth/react";
import {QuizService} from "~/services/quizService";
import syncService from "~/services/syncService";

export function useCreateQuiz() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    const createQuiz = async (quiz: Quiz): Promise<void> => {
        // Save locally
        await QuizService.createQuiz(quiz);

        if (isAuthenticated) {
            try {
                await syncService.syncNewQuiz(quiz);
            } catch (error) {
                console.error("Failed to sync quiz remotely:", error);
            }
        } else {
            console.warn("User not authenticated; remote sync skipped.");
        }
    };

    return { createQuiz };
}
