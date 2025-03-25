// src/services/syncService.ts
import { api } from "~/trpc/react";
import type {ChatMessage, Quiz} from "~/db/dexie";

/**
 * Service responsible for synchronizing local data with the remote server.
 */
export class SyncService {
    /**
     * Syncs a chat message to the remote server.
     *
     * @param message - The chat message to sync.
     */
    async syncChatMessage(message: ChatMessage): Promise<void> {
        try {
            await api.chatMessage.add.useMutation().mutateAsync({
                id: message.id,
                quizId: message.quizId,
                role: message.role,
                content: message.content,
                createdAt: message.createdAt,
            });
            console.log("[SYNC] Chat message synced to remote server.");
        } catch (error) {
            console.error("[SYNC ERROR] Failed to sync chat message:", error);
            // TODO: Consider implementing retry logic or queue the message for future syncing.

            // Re-throw the error if you want the calling code to handle it as well.
            throw error;
        }
    }

    /**
     * Syncs a new quiz to the remote server.
     *
     * @param quiz - The quiz to sync.
     */
    async syncNewQuiz(quiz: Quiz): Promise<void> {
        try {
            await api.quiz.create.useMutation().mutateAsync({
                id: quiz.id,
                title: quiz.title,
                createdAt: quiz.createdAt,
                updatedAt: quiz.updatedAt,
                lastMessageAt: quiz.lastMessageAt,
            });
            console.log("[SYNC] New quiz synced to remote server.");
        } catch (error) {
            console.error("[SYNC ERROR] Failed to sync new quiz:", error);
            throw error;
        }
    }

    // TODO: Some refactoring will need to be done between dedicated syncing service and hooks layer

    /**
     * Fetches all user data (quizzes and chat messages) from the remote Prisma server.
     */
    async fetchUserData(): Promise<{
        quizzes: Quiz[];
        chatMessages: ChatMessage[];
    }> {
        try {
            const quizzes: Quiz[] | undefined = api.quiz.getByUser.useQuery().data ?? [];
            const chatMessages: ChatMessage[] | undefined = api.chatMessage.getUserChatMessages.useQuery().data ?? [];
            console.log("[SYNC] Fetched user data from remote server.");
            return { quizzes, chatMessages };
        } catch (error) {
            console.error("[SYNC ERROR] Failed to fetch user data:", error);
            throw error;
        }
    }
}

const syncService = new SyncService();
export default syncService;
