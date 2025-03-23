// src/hooks/useChatMessageSync.ts
import { db } from "~/db/dexie";
import { api } from "~/trpc/react";
import type { ChatMessage } from "~/types/ChatMessage";
import { useSession } from "next-auth/react";

export function useChatMessageSync() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";
    const addChatMessageMutation = api.chatMessage.add.useMutation();

    const addChatMessageSync = async (message: ChatMessage): Promise<void> => {
        try {
            // Save the chat message locally in Dexie.
            await db.chatMessages.add(message);
            console.log("Chat message saved locally:", message.id);

            // If authenticated, sync the message to the server.
            if (isAuthenticated) {
                await addChatMessageMutation.mutateAsync({
                    quizId: message.quizId,
                    role: message.role,
                    content: message.content
                });
                console.log("Chat message synced to server for quiz:", message.quizId);
            } else {
                console.warn(
                    "User not authenticated; chat message not synced to the server."
                );
            }
        } catch (error) {
            console.error("Error syncing chat message:", error);
            throw error;
        }
    };

    return { addChatMessageSync, isAuthenticated };
}
