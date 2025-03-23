// src/db/dexie.ts
import Dexie, { type Table } from "dexie";
import { type ChatMessage } from "~/types/ChatMessage";
import { type Quiz } from "~/types/Quiz";
import { type User} from "~/types/User"


/**
 * AskovaClientDatabase
 *
 * This Dexie instance is designed to support a robust clientside chat interface.
 * Key optimizations:
 *
 * 2. Compound indexes:
 *    - In chatMessages: the compound index [quizId+createdAt] allows fast queries
 *      on all messages for a given chat, sorted chronologically.
 *
 */
export class AskovaClientDatabase extends Dexie {
    public quizzes!: Table<Quiz, string>;
    public chatMessages!: Table<ChatMessage, number>;
    public user!: Table<User, string>;


    public constructor() {
        super("AskovaClientDatabase");
        // Define the schema for the database.
        this.version(1).stores({
            quizzes: "id, title, userId, createdAt, updatedAt",
            chatMessages: "++id, quizId, role, content, createdAt, [quizId+createdAt]",
            user: "id, name",
        });
    }

    /**
     * Clears all tables in the database within a transaction.
     */
    async clearAllData(): Promise<void> {
        return this.transaction("rw", this.quizzes, this.chatMessages, this.user, async () => {
            await Promise.all([
                this.quizzes.clear(),
                this.chatMessages.clear(),
                this.user.clear(),
            ]);
        });
    }
}

export const db = new AskovaClientDatabase();
