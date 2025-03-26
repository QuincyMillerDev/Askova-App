// src/db/dexie.ts
import Dexie, { type Table } from "dexie";

export type MessageRole = "user" | "model";
export type MessageStatus =
    | "done"
    | "error"
    | "waiting"
    | "streaming"
    | "deleted"; // Local tracking of the message status
export type QuizStatus = "done" | "error" | "waiting" | "deleted"; // Local tracking of quiz status

export interface Quiz {
    id: string; // Primary key.
    title: string;
    createdAt: Date;
    updatedAt: Date;
    lastMessageAt: Date;
    status: QuizStatus;
}

export interface ChatMessage {
    id: string;
    quizId: string; // The Quiz id this message belongs to.
    role: MessageRole;
    content: string;
    createdAt: Date;
    status: MessageStatus;
}

export class askovadb extends Dexie {
    public quizzes!: Table<Omit<Quiz, "messages">, string>; // Use Omit if messages aren't stored here
    public chatMessages!: Table<ChatMessage, string>;

    public constructor() {
        super("askovadb");
        // Define the schema for the database.
        this.version(1).stores({
            quizzes: "id, title, createdAt, updatedAt, lastMessageAt, status", // <-- Fixed: Comma added
            chatMessages:
                "id, quizId, role, content, createdAt, status, [quizId+createdAt], [quizId+status]",
        });

        // Optional: Define relationships for easier querying if needed later
        // this.quizzes.mapToClass(Quiz); // Map if you have a Quiz class
        // this.chatMessages.mapToClass(ChatMessage); // Map if you have a ChatMessage class
    }

    // TODO: Add some protection/error handling here
    /**
     * Clears all tables in the database within a transaction.
     */
    async clearAllData(): Promise<void> {
        return this.transaction(
            "rw",
            this.quizzes,
            this.chatMessages,
            async () => {
                await Promise.all([this.quizzes.clear(), this.chatMessages.clear()]);
            }
        );
    }
}

export const db = new askovadb();
