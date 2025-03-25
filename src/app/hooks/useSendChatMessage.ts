// src/hooks/useSendChatMessage.ts
import { useSession } from "next-auth/react";
import { ChatMessageService } from "~/services/chatMessageService";
import {type ChatMessage} from "~/db/dexie";
import syncService from "~/services/syncService";

export function useSendChatMessage() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    const sendMessage = async (chatMessage: ChatMessage): Promise<void> => {
        // Save locally
        await ChatMessageService.addMessage(chatMessage);

        // If authenticated, sync the message remotely.
        if (isAuthenticated) {
            try {
                await syncService.syncChatMessage(chatMessage);
            } catch (error) {
                console.error("Failed to sync chat message remotely:", error);
            }
        } else {
            console.warn("User not authenticated; remote sync skipped.");
        }
    };

    return { sendMessage };
}
