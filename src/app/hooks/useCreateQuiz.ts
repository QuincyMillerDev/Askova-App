// src/app/hooks/useCreateQuiz.ts
import { db, type ChatMessage, type Quiz } from "~/db/dexie"; // Import db for transaction
import { useSession } from "next-auth/react";
import { QuizService } from "~/services/quizService";
import { ChatMessageService } from "~/services/chatMessageService";
import syncService from "~/services/syncService";
import { useCallback } from "react";

export function useCreateQuiz() {
    const { data: session } = useSession();
    const isAuthenticated = !!session?.user?.id;

    /**
     * Creates a quiz and its first message locally, then attempts to sync both remotely
     * in the correct order (quiz first, then message).
     * @param quizData - Data for the new quiz (excluding messages).
     * @param firstMessageData - Data for the initial message.
     * @returns Promise<boolean> - True if local save succeeded and remote sync was either successful or skipped, false otherwise.
     */
    const createQuiz = useCallback(
        async (
            quizData: Omit<Quiz, "messages">, // Ensure correct type from Dexie schema
            firstMessageData: ChatMessage
        ): Promise<boolean> => {
            // --- 1. Local Save (Atomic Transaction) ---
            try {
                // Use a Dexie transaction to ensure both are saved or neither is.
                await db.transaction("rw", db.quizzes, db.chatMessages, async () => {
                    // These services use the underlying repositories which use db.quizzes.put etc.
                    await QuizService.createOrUpdateQuiz(quizData);
                    await ChatMessageService.addOrUpdateLocalMessage(firstMessageData); // This also updates quiz timestamps locally
                });
                console.log(
                    `[HOOK] Locally saved quiz ${quizData.id} and message ${firstMessageData.id}`
                );
            } catch (localError) {
                console.error(
                    "[HOOK ERROR] Failed to save quiz/message locally:",
                    localError
                );
                return false; // Fail early if local save fails
            }

            // --- 2. Remote Sync (if authenticated) ---
            if (isAuthenticated) {
                console.log(
                    `[HOOK] User authenticated, attempting remote sync for quiz ${quizData.id}`
                );
                try {
                    // --- Sync Quiz First ---
                    await syncService.uploadQuiz(quizData);
                    console.log(`[HOOK] Remote sync successful for quiz ${quizData.id}`);

                    // --- Sync Message Second (only if quiz sync succeeded) ---
                    try {
                        await syncService.uploadChatMessage(firstMessageData);
                        console.log(
                            `[HOOK] Remote sync successful for message ${firstMessageData.id}`
                        );
                    } catch (messageSyncError) {
                        console.error(
                            `[HOOK ERROR] Remote sync failed for message ${firstMessageData.id} after quiz sync succeeded:`,
                            messageSyncError
                        );
                        // Log the error, but consider the overall operation successful for UI flow
                        // because the quiz exists locally & remotely. Bulk sync can retry the message later.
                    }
                } catch (quizSyncError) {
                    console.error(
                        `[HOOK ERROR] Remote sync failed for quiz ${quizData.id}:`,
                        quizSyncError
                    );
                    // If the primary entity (quiz) fails remote sync, report failure.
                    return false;
                }
            } else {
                console.warn(
                    `[HOOK] User not authenticated; remote sync skipped for quiz ${quizData.id}.`
                );
            }

            // If we reached here, local save was successful, and remote sync either succeeded,
            // was skipped, or only the message part failed (which is recoverable).
            return true;
        },
        [isAuthenticated] // Hook depends on authentication status
    );

    return { createQuiz };
}
