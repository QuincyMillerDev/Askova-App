// src/services/chatMessageService.ts
import type { ChatMessage, Quiz, MessageStatus } from "~/db/dexie";
import { db } from "~/db/dexie"; // Import db directly for efficient updates
import chatMessageRepository from "~/db/repositories/chatMessageDexieRepository";
import quizRepository from "~/db/repositories/quizDexieRepository"; // Keep for timestamp updates

export const ChatMessageService = {
    /**
     * Adds or updates a chat message locally in Dexie.
     * If the message status is 'done', it also updates the associated quiz's timestamps.
     * Use this for initial creation of user messages and AI placeholders.
     * @param chatMessage - The chat message to add or update.
     */
    async addOrUpdateLocalMessage(chatMessage: ChatMessage): Promise<void> {
        await chatMessageRepository.createOrUpdate(chatMessage);

        // Update quiz timestamps only if the message is 'done' or maybe always?
        // Let's update always for simplicity, lastMessageAt reflects latest activity.
        const quiz: Quiz | undefined = await quizRepository.getById(
            chatMessage.quizId
        );
        if (quiz) {
            const now = new Date(); // Use current time for update
            const updates: Partial<Quiz> = { updatedAt: now };
            // Only update lastMessageAt if the new message is later
            if (chatMessage.createdAt > quiz.lastMessageAt) {
                updates.lastMessageAt = chatMessage.createdAt;
            }
            // Use Dexie's update for efficiency
            await db.quizzes.update(chatMessage.quizId, updates);
        } else {
            console.warn(
                `Quiz with id ${chatMessage.quizId} not found when adding/updating message ${chatMessage.id}. Timestamps not updated.`
            );
        }
    },

    /**
     * Efficiently updates the status and appends content for an existing local chat message.
     * Primarily used for updating AI message placeholders during streaming.
     * Does NOT update quiz timestamps directly here.
     * @param messageId - The ID of the message to update.
     * @param newStatus - The new status.
     * @param contentChunk - Content chunk to append.
     */
    async appendLocalMessageContent(
        messageId: string,
        newStatus: MessageStatus, // Usually 'streaming'
        contentChunk: string
    ): Promise<void> {
        try {
            // Use Dexie's modify for efficient appending and status update
            const updated = await db.chatMessages
                .where("id")
                .equals(messageId)
                .modify((msg) => {
                    // Ensure msg exists (should always if ID is correct)
                    if (msg) {
                        msg.content += contentChunk;
                        // Only update status if it's changing (e.g., from 'waiting' to 'streaming')
                        if (msg.status !== newStatus) {
                            msg.status = newStatus;
                        }
                    }
                });
            if (!updated) {
                console.warn(`[ChatMessageService] Message ${messageId} not found for append.`);
            }
        } catch (error) {
            console.error(
                `[ChatMessageService] Error appending content for message ${messageId}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Updates the status and optionally replaces the entire content of a local message.
     * Used for setting final 'done' or 'error' states.
     * @param messageId - The ID of the message to update.
     * @param newStatus - The new status (e.g., 'done', 'error').
     * @param finalContent - Optional: The complete final content (e.g., error message).
     */
    async updateLocalMessageStatus(
        messageId: string,
        newStatus: MessageStatus,
        finalContent?: string
    ): Promise<void> {
        try {
            const updates: { status: MessageStatus; content?: string } = {
                status: newStatus,
            };
            if (finalContent !== undefined) {
                updates.content = finalContent;
            }

            const count = await db.chatMessages.update(messageId, updates);

            if (count === 0) {
                console.warn(
                    `[ChatMessageService] Message ${messageId} not found for final status update.`
                );
            }
        } catch (error) {
            console.error(
                `[ChatMessageService] Error updating final status for message ${messageId}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Retrieves a chat message by its ID from Dexie.
     * @param messageId - The ID of the message.
     * @returns The message or undefined if not found.
     */
    async getLocalMessageById(messageId: string): Promise<ChatMessage | undefined> {
        return chatMessageRepository.getById(messageId);
    }
};
