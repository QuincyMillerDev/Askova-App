// src/types/ChatMessage.ts
export type ChatRole = "user" | "model";

export interface ChatMessage {
    // This corresponds to the ChatMessage model in Prisma.
    id: number;
    sessionId: string; // The Quiz id this message belongs to.
    role: ChatRole;
    content: string;
    createdAt: Date;
}