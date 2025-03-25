import {type Quiz} from "~/db/dexie";
import quizDexieRepository from "~/db/repositories/quizDexieRepository";

export const QuizService = {
    async createQuiz(quiz: Quiz): Promise<void> {
        // Save quiz to Dexie
        await quizDexieRepository.createOrUpdate(quiz);
    }
}