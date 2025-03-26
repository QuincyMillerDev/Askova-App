// src/services/quizService.ts
import { type Quiz, type QuizStatus, db } from "~/db/dexie"; // Import db if not already
import quizDexieRepository from "~/db/repositories/quizDexieRepository";

export const QuizService = {
    /**
     * Creates or updates a quiz locally in Dexie.
     * @param quiz - The quiz data.
     */
    async createOrUpdateQuiz(quiz: Quiz): Promise<void> {
        // Use the repository method which handles the actual Dexie operation
        await quizDexieRepository.createOrUpdate(quiz);
    },

    /**
     * Updates the status of a local quiz in Dexie.
     * Also updates the `updatedAt` timestamp.
     * @param quizId - The ID of the quiz to update.
     * @param newStatus - The new status.
     */
    async updateLocalQuizStatus(
        quizId: string,
        newStatus: QuizStatus
    ): Promise<void> {
        try {
            // Use Dexie's update method for targeted updates if preferred,
            // or fetch-then-put as implemented in the repository.
            // Using Dexie's update directly can be slightly more efficient.
            const count = await db.quizzes.update(quizId, {
                status: newStatus,
                updatedAt: new Date(), // Keep updatedAt fresh
            });

            if (count === 0) {
                console.warn(
                    `[QuizService] Quiz ${quizId} not found for status update.`
                );
            }
        } catch (error) {
            console.error(
                `[QuizService] Error updating status for quiz ${quizId}:`,
                error
            );
            // Re-throw or handle as needed
            throw error;
        }
    },

    /**
     * Retrieves a quiz by its ID from Dexie.
     * @param quizId - The ID of the quiz.
     * @returns The quiz or undefined if not found.
     */
    async getLocalQuizById(quizId: string): Promise<Quiz | undefined> {
        return quizDexieRepository.getById(quizId);
    },
};
