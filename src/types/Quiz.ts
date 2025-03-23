// src/types/Quiz.ts
import {type ChatMessage} from '~/types/ChatMessage';

export interface Quiz {
    // This corresponds to the Quiz model in Prisma.
    id: string; // Primary key.
    title?: string; // Optional title.
    userId?: string; // Optional, since a quiz may be created without authentication.
    createdAt: Date;
    updatedAt: Date;
    messages: ChatMessage[]; // List of chat messages.
    synced?: boolean;
}
