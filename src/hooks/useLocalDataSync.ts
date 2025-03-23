// src/hooks/useLocalDataSync.ts
import { useEffect, useCallback } from "react";
import { useQuizSync } from "./useQuizSync";
import { useChatMessageSync } from "./useChatMessageSync";
import {db} from "~/db/dexie";
import type {Quiz} from "~/types/Quiz";

export function useLocalDataSync(isAuthenticated: boolean) {
    const { createQuizSync } = useQuizSync();
    const { addChatMessageSync } = useChatMessageSync();

    const syncLocalData = useCallback(async () => {
        try {
            // Step 1: Process quizzes.
            const allQuizzes: Quiz[] = await db.quizzes.toArray();
            // Only consider quizzes not yet synced (or you might add a force‑sync flag)
            const unsyncedQuizzes = allQuizzes.filter((q) => !q.synced);

            // Group by id and for each group select the quiz with the latest updatedAt.
            const quizMap = new Map<string, typeof unsyncedQuizzes[0]>();
            unsyncedQuizzes.forEach((quiz) => {
                const existing = quizMap.get(quiz.id);
                if (!existing || new Date(quiz.updatedAt) > new Date(existing.updatedAt)) {
                    quizMap.set(quiz.id, quiz);
                }
            });

            // For each deduplicated quiz, attempt to sync.
            for (const quiz of quizMap.values()) {
                await createQuizSync(quiz);
                // Mark all local quizzes with the same id as synced.
                await db.quizzes.where("id").equals(quiz.id).modify({ synced: true });
            }

            // Step 2: Process chat messages.
            // Get only unsynced messages.
            const unsyncedMessages = await db.chatMessages.filter((m) => !m.synced).toArray();
            for (const message of unsyncedMessages) {
                // Only sync a chat message if its parent quiz is already synced.
                const quiz = await db.quizzes.get(message.quizId);
                if (!quiz || !quiz.synced) continue;
                await addChatMessageSync(message);
                // Mark message as synced after a successful upload.
                await db.chatMessages.update(message.id, { synced: true });
            }
        } catch (error) {
            console.error("Error syncing local data:", error);
        }
    }, [createQuizSync, addChatMessageSync]);

    useEffect(() => {
        if (isAuthenticated) {
            void syncLocalData();
        }
    }, [isAuthenticated, syncLocalData]);
}
