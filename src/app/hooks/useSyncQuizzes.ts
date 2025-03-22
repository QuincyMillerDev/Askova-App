// src/hooks/useSyncQuizzes.ts
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { db } from "~/db/dexie";
import { type Quiz as DexieQuiz } from "~/types/Quiz";

export function useSyncQuizzes() {
    const { data: session } = useSession();
    const [isSyncing, setIsSyncing] = useState(false);
    // A ref to ensure we only sync once per user session
    const hasSyncedRef = useRef(false);
    const createQuizMutation = api.quiz.create.useMutation();

    useEffect(() => {
        // Only run if the user is authenticated
        // and we haven't synced yet for this session.
        if (session?.user?.id && !hasSyncedRef.current) {
            hasSyncedRef.current = true; // Mark as synced for this user session
            const syncQuizzes = async () => {
                setIsSyncing(true);
                try {
                    // Get unsynced quizzes (those having userId === undefined)
                    const unsyncedQuizzes: DexieQuiz[] = await db.quizzes
                        .filter((quiz) => quiz.userId === undefined)
                        .toArray();

                    await Promise.all(
                        unsyncedQuizzes.map(async (quiz) => {
                            try {
                                // Use our upsert mutation on the server side
                                await createQuizMutation.mutateAsync({
                                    id: quiz.id,
                                    title: quiz.title,
                                });
                                // Update the local Dexie record so we don't sync it again.
                                await db.quizzes.update(quiz.id, { userId: session.user.id });
                            } catch (error) {
                                console.error(`Error syncing quiz ${quiz.id}:`, error);
                            }
                        })
                    );
                } catch (error) {
                    console.error("Error getting unsynced quizzes:", error);
                } finally {
                    setIsSyncing(false);
                }
            };

            void syncQuizzes();
        }
    }, [session?.user?.id, createQuizMutation]);

    return { isSyncing };
}
