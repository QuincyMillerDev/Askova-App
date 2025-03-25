// src/db/repositories/ChatMessageDexieRepository.ts
import Dexie from "dexie";
import { type ChatMessage, db, type MessageStatus } from "../dexie";

/**
 * Repository for performing CRUD operations on ChatMessage records.
 */
export class ChatMessageDexieRepository {
    /**
     * Creates or updates a single chat message.
     * The returned key is ignored so that the method returns void.
     *
     * @param message - The chat message to create or update.
     */
    async createOrUpdate(message: ChatMessage): Promise<void> {
        await db.chatMessages.put(message);
    }

    /**
     * Bulk creates or updates a list of chat messages.
     * The returned keys are ignored so that the method returns void.
     *
     * @param messages - An array of chat messages to create or update.
     */
    async bulkCreateOrUpdate(messages: ChatMessage[]): Promise<void> {
        await db.chatMessages.bulkPut(messages);
    }

    /**
     * Retrieves a chat message by its id.
     *
     * @param id - The id of the chat message.
     * @returns A promise that resolves to the chat message or undefined if not found.
     */
    async getById(id: string): Promise<ChatMessage | undefined> {
        return db.chatMessages.get(id);
    }

    /**
     * Retrieves all chat messages for a given quiz sorted by creation date.
     * This query leverages the compound index [quizId+createdAt].
     *
     * @param quizId - The id of the quiz.
     * @returns An array of chat messages ordered by createdAt.
     */
    async getByQuizIdSortedByCreatedAt(quizId: string): Promise<ChatMessage[]> {
        return db.chatMessages
            .where("[quizId+createdAt]")
            .between([quizId, Dexie.minKey], [quizId, Dexie.maxKey])
            .toArray();
    }

    /**
     * Retrieves all chat messages for a quiz that have a specific status.
     * This method leverages the compound index [quizId+status].
     *
     * @param quizId - The id of the quiz.
     * @param status - The message status to filter by.
     * @returns An array of chat messages matching the criteria.
     */
    async getByQuizIdAndStatus(
        quizId: string,
        status: MessageStatus
    ): Promise<ChatMessage[]> {
        return db.chatMessages
            .where("[quizId+status]")
            .equals([quizId, status])
            .toArray();
    }

    /**
     * Retrieves all chat messages ordered by creation date.
     *
     * @returns An array of chat messages ordered by createdAt.
     */
    async getAll(): Promise<ChatMessage[]> {
        return db.chatMessages.orderBy("createdAt").toArray();
    }

    /**
     * Deletes a chat message by its id.
     *
     * @param id - The id of the chat message to delete.
     */
    async delete(id: string): Promise<void> {
        await db.chatMessages.delete(id);
    }
}

const chatMessageRepository = new ChatMessageDexieRepository();
export default chatMessageRepository;