// src/services/sync.ts
import { db } from "~/db/dexie";
import { api } from "~/trpc/react";
import type {Quiz} from "~/types/Quiz";

/**
 * Upload any unsynced quizzes from Dexie to Prisma.
 * Here, "unsynced" means the quiz doesn’t have a userId associated.
 */
export async function uploadUnsyncedData(
    userId: string,
    createQuiz: (data: { id: string; title?: string }) => Promise<Quiz>
) {
    // Fetch all quizzes in Dexie that have no userId (unsynced)
    const unsyncedQuizzes = await db.quizzes
        .where("userId")
        .equals(undefined as unknown as string)
        .toArray();

    for (const quiz of unsyncedQuizzes) {
        try {
            // Use the passed-in mutation function to create the quiz on the backend.
            await createQuiz({
                id: quiz.id,
                title: quiz.title,
            });
            // Once successful, update Dexie to mark that this quiz is now associated with the user.
            await db.quizzes.update(quiz.id, { userId });
        } catch (error) {
            console.error("Error syncing quiz", quiz.id, error);
        }
    }
}

/**
 * Clears all local data from Dexie.
 */
export async function clearLocalData() {
    await db.transaction(
        "rw",
        db.quizzes,
        db.chatMessages,
        db.user,
        async () => {
            await Promise.all([
                db.quizzes.clear(),
                db.chatMessages.clear(),
                db.user.clear(),
            ]);
        }
    );
}

/**
 * Refresh Dexie—pull the full user record from Prisma and rehydrate Dexie.
 */
export async function refreshLocalFromRemote(userId: string) {
    try {
        // Fetch full user data (including quizzes and messages).
        const userData = await api.user.getUserData.query();
        if (userData) {
            // Clear before inserting.
            await clearLocalData();

            // Insert the primary user details.
            await db.user.put(userData);

            if (userData.quizzes && userData.quizzes.length > 0) {
                // Bulk insert quizzes.
                await db.quizzes.bulkPut(userData.quizzes);

                // For each quiz, insert its messages.
                for (const quiz of userData.quizzes) {
                    if (quiz.messages && quiz.messages.length > 0) {
                        await db.chatMessages.bulkPut(quiz.messages);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error refreshing local data from remote", error);
    }
}
