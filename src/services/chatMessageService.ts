// src/services/chatMessageService.ts
import type {ChatMessage, Quiz} from "~/db/dexie";
import chatMessageRepository from "~/db/repositories/chatMessageDexieRepository";
import quizRepository from "~/db/repositories/quizDexieRepository";

export const ChatMessageService = {
    /**
     * Adds a new chat message and updates the associated quiz timestamps.
     *
     * @param chatMessage - The chat message to add.
     */
    async addMessage(chatMessage: ChatMessage): Promise<void> {
        // Save the chat message locally.
        await chatMessageRepository.createOrUpdate(chatMessage);

        // Retrieve the related quiz.
        const quiz: Quiz | undefined = await quizRepository.getById(chatMessage.quizId);
        if (quiz) {
            // Update the quiz's timestamps.
            quiz.updatedAt = chatMessage.createdAt;
            quiz.lastMessageAt = chatMessage.createdAt;
            await quizRepository.createOrUpdate(quiz);
        } else {
            console.warn(
                `Quiz with id ${chatMessage.quizId} not found? Timestamps not updated.`
            );
        }
    },
};
