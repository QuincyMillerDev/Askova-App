// src/db/repositories/QuizDexieRepository.ts
import { db, type Quiz } from "../dexie";

/**
 * Repository for performing CRUD operations on Quiz entities.
 */
export class QuizDexieRepository {
    /**
     * Creates or updates a single quiz in the Dexie database.
     * The returned key from Dexie is ignored so that the method returns void.
     *
     * @param quiz - The quiz object to create or update.
     */
    async createOrUpdate(quiz: Quiz): Promise<void> {
        await db.quizzes.put(quiz);
    }

    /**
     * Bulk creates or updates multiple quizzes.
     * The returned keys are ignored so that the method returns void.
     *
     * @param quizzes - An array of quizzes to create or update.
     */
    async bulkCreateOrUpdate(quizzes: Quiz[]): Promise<void> {
        await db.quizzes.bulkPut(quizzes);
    }

    /**
     * Retrieves a quiz by its id.
     *
     * @param id - The id of the quiz.
     * @returns A promise that resolves to the quiz or undefined if not found.
     */
    async getById(id: string): Promise<Quiz | undefined> {
        return db.quizzes.get(id);
    }

    /**
     * Retrieves all quizzes ordered by creation date (newest first).
     *
     * @returns A promise that resolves to an array of quizzes.
     */
    async getAll(): Promise<Quiz[]> {
        return db.quizzes.orderBy("createdAt").reverse().toArray();
    }

    /**
     * Deletes a quiz by its id.
     *
     * @param id - The id of the quiz to delete.
     */
    async delete(id: string): Promise<void> {
        await db.quizzes.delete(id);
    }
}

// Create an instance and export it as the default export.
const quizRepository = new QuizDexieRepository();
export default quizRepository;
