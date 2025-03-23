// src/db/dexie.ts
import Dexie, { type Table } from "dexie";
import { type ChatMessage } from "~/types/ChatMessage";
import { type Quiz } from "~/types/Quiz";
import { type User} from "~/types/User"

export class AskovaClientDatabase extends Dexie {
    public quizzes!: Table<Quiz, string>;
    public chatMessages!: Table<ChatMessage, number>;
    public user!: Table<User, string>;


    public constructor() {
        super("AskovaClientDatabase");
        // Define the schema for the database.
        this.version(1).stores({
            quizzes: "id, title, userId, createdAt, updatedAt",
            chatMessages: "++id, sessionId, role, createdAt",
            user: "id, name",
        });
    }
}

export const db = new AskovaClientDatabase();
