// src/hooks/useQuizSync.ts
import { db } from "~/db/dexie";
import { api } from "~/trpc/react";
import type { Quiz } from "~/types/Quiz";
import { useSession } from "next-auth/react";

export function useQuizSync() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";
    const createQuizMutation = api.quiz.create.useMutation();

    const createQuizSync = async (quiz: Quiz): Promise<void> => {
        try {
            // Write the quiz session locally.
            await db.quizzes.put(quiz);
            console.log("Quiz saved locally:", quiz.id);

            // If the quiz is associated with an authenticated user, sync to the server.
            if (quiz.userId && isAuthenticated) {
                await createQuizMutation.mutateAsync({
                    id: quiz.id,
                    title: quiz.title
                });
                console.log("Quiz synced to server:", quiz.id);
            } else {
                console.warn(
                    "Quiz created without an authenticated user. Server sync skipped."
                );
            }
        } catch (error) {
            console.error("Error syncing quiz:", error);
            throw error;
        }
    };

    return { createQuizSync, isAuthenticated };
}
