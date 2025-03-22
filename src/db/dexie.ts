// src/db/dexie.ts
import Dexie, { type Table } from "dexie";
import { type ChatMessage } from "~/types/ChatMessage";
import { type Quiz } from "~/types/Quiz";

export class MyAppDatabase extends Dexie {
    // A table for quizzes keyed by the quiz id.
    public quizzes!: Table<Quiz, string>;
    // A table for chat messages keyed by an auto-incremented numeric id.
    public chatMessages!: Table<ChatMessage, number>;

    public constructor() {
        super("MyAppDatabase");
        // Define the schema for the database.
        this.version(1).stores({
            quizzes: "id, title, userId, createdAt, updatedAt",
            chatMessages: "++id, sessionId, role, createdAt",
        });
    }

    // --- Quiz CRUD operations ---

    // Create or update a quiz.
    async saveQuiz(quiz: Quiz): Promise<void> {
        await this.quizzes.put(quiz);
    }

    // Retrieve a quiz by its id.
    async getQuiz(id: string): Promise<Quiz | undefined> {
        return this.quizzes.get(id);
    }

    // Retrieve all quizzes.
    async getAllQuizzes(): Promise<Quiz[]> {
        return this.quizzes.toArray();
    }

    // Update a quiz with partial data.
    async updateQuiz(id: string, update: Partial<Quiz>): Promise<number> {
        // Returns the number of records updated (0 or 1)
        return this.quizzes.update(id, update);
    }

    // Delete a quiz and its associated chat messages.
    async deleteQuiz(id: string): Promise<void> {
        await this.quizzes.delete(id);
        // Also remove all chat messages belonging to this quiz/session.
        await this.chatMessages.where("sessionId").equals(id).delete();
    }

    // --- ChatMessage CRUD operations ---

    // Add a new chat message.
    async addChatMessage(message: ChatMessage): Promise<number> {
        // Returns the generated numeric id.
        return this.chatMessages.add(message);
    }

    // Retrieve all chat messages for a given quiz (session).
    async getChatMessages(quizId: string): Promise<ChatMessage[]> {
        return this.chatMessages.where("sessionId").equals(quizId).toArray();
    }

    // Update a chat message by its numeric id.
    async updateChatMessage(id: number, update: Partial<ChatMessage>): Promise<number> {
        return this.chatMessages.update(id, update);
    }

    // Delete a chat message by its numeric id.
    async deleteChatMessage(id: number): Promise<void> {
        await this.chatMessages.delete(id);
    }
}

export const db = new MyAppDatabase();
