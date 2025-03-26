// src/app/hooks/useSendChatMessage.ts
import { useSession } from "next-auth/react";
import { ChatMessageService } from "~/services/chatMessageService";
import { type ChatMessage } from "~/db/dexie";
import syncService from "~/services/syncService"; // Import the refactored service

export function useSendChatMessage() {
    const { data: session } = useSession();
    const isAuthenticated = !!session?.user?.id;

    // Renamed to avoid conflict with service name
    const sendMessageAndUpdate = async (
        chatMessage: ChatMessage
    ): Promise<void> => {
        // 1. Save locally first
        await ChatMessageService.addMessage(chatMessage);

        // 2. If authenticated, trigger background sync
        if (isAuthenticated) {
            console.log(
                `[HOOK] User authenticated, attempting background sync for message ${chatMessage.id}`
            );
            syncService.uploadChatMessage(chatMessage).catch((error) => {
                console.error(
                    `[HOOK ERROR] Background sync failed for message ${chatMessage.id}:`,
                    error
                );
            });
        } else {
            console.warn(
                `[HOOK] User not authenticated; remote sync skipped for message ${chatMessage.id}.`
            );
        }
    };

    // Keep original export name if used elsewhere, or update calls
    return { sendMessageAndUpdate };
}