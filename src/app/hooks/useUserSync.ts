import { useCallback } from "react";
import syncService from "~/services/syncService";
import quizRepository from "~/db/repositories/quizDexieRepository";
import chatMessageRepository from "~/db/repositories/chatMessageDexieRepository";

export function useUserSync() {
    const syncUserData = useCallback(async () => {
        // --- Upload outstanding local data to Prisma ---
        // Upload any local quizzes via SyncService.
        // TODO: Modify upload logic to be handled in sync service on a bulk level
        try {
            const localQuizzes = await quizRepository.getAll();
            for (const quiz of localQuizzes) {
                try {
                    await syncService.syncNewQuiz(quiz);
                } catch (error) {
                    console.error(
                        `Failed to sync quiz with id ${quiz.id}`,
                        error
                    );
                    // Decide here if you want to break or continue to the next item.
                }
            }
        } catch (error) {
            console.error("Error fetching local quizzes:", error);
        }

        // Upload any local chat messages.
        try {
            const localMessages = await chatMessageRepository.getAll();
            for (const message of localMessages) {
                try {
                    await syncService.syncChatMessage(message);
                } catch (error) {
                    console.error(
                        `Failed to sync chat message with id ${message.id}`,
                        error
                    );
                }
            }
        } catch (error) {
            console.error("Error fetching local chat messages:", error);
        }

        // --- Fetch remote user data (quizzes and messages) from Prisma ---
        const remoteData = await syncService.fetchUserData();
        if (remoteData) {
            const { quizzes, chatMessages } = remoteData;
            // Update the local Dexie database with the freshest data from Prisma.
            await quizRepository.bulkCreateOrUpdate(quizzes);
            await chatMessageRepository.bulkCreateOrUpdate(chatMessages);
        }
    }, []);

    return { syncUserData };
}
