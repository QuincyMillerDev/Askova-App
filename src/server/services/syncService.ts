// src/services/syncService.ts
import { serviceTrpcClient } from "~/trpc/service-client";
import type { ChatMessage, Quiz } from "~/db/dexie";
import quizRepository from "~/db/repositories/quizDexieRepository";
import chatMessageRepository from "~/db/repositories/chatMessageDexieRepository";

class SyncService {
    // uploadQuiz and uploadChatMessage methods remain the same...
    // (Ensure they handle potential errors and maybe return success/failure or ID)

    /**
     * Uploads/Updates a single quiz to the remote server.
     */
    async uploadQuiz(quiz: Omit<Quiz, "messages">): Promise<string> {
        // Ensure 'messages' is not sent if it exists on the input type
        try {
            await serviceTrpcClient.quiz.upsert.mutate(quiz);
            console.log(`[SYNC] Quiz ${quiz.id} uploaded/updated.`);
            return quiz.id; // Return ID on success
        } catch (error) {
            console.error(`[SYNC ERROR] Failed to upload quiz ${quiz.id}:`, error);
            throw error;
        }
    }

    /**
     * Uploads/Updates a single chat message to the remote server.
     */
    async uploadChatMessage(message: ChatMessage): Promise<string> {
        try {
            await serviceTrpcClient.chatMessage.upsert.mutate(message);
            console.log(`[SYNC] Message ${message.id} uploaded/updated.`);
            return message.id; // Return ID on success
        } catch (error) {
            console.error(
                `[SYNC ERROR] Failed to upload message ${message.id}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Performs a full synchronization using a hybrid concurrent approach:
     * 1. Fetches all remote quizzes and messages for the user.
     * 2. Fetches all local quizzes and messages.
     * 3. Identifies local-only quizzes and uploads them CONCURRENTLY.
     * 4. Waits for quiz uploads to settle.
     * 5. Identifies local-only messages whose quizzes now exist remotely (either pre-existing or just uploaded).
     * 6. Uploads the valid messages CONCURRENTLY.
     * 7. Waits for message uploads to settle.
     * 8. Updates the local Dexie database with the fetched remote data.
     *
     * NOTE: For extremely large datasets, backend bulk endpoints (`bulkUpsert`) are recommended
     *       for optimal performance, but this approach is much faster than fully sequential uploads.
     */
    async performBulkSync(): Promise<{
        uploadedQuizzes: number;
        failedQuizUploads: number;
        uploadedMessages: number;
        failedMessageUploads: number;
        skippedMessages: number; // Messages skipped because quiz upload failed/doesn't exist
        downloadedQuizzes: number;
        downloadedMessages: number;
    }> {
        console.log("[SYNC] Starting bulk sync (hybrid concurrent)...");
        const startTime = Date.now();
        let uploadedQuizzes = 0;
        let failedQuizUploads = 0;
        let uploadedMessages = 0;
        let failedMessageUploads = 0;
        let skippedMessages = 0;
        const successfullyUploadedQuizIds = new Set<string>();

        try {
            // --- 1. Fetch Remote Data ---
            const remoteFetchStartTime = Date.now();
            const remoteQuizzesPromise = serviceTrpcClient.quiz.getByUser.query();
            const remoteMessagesPromise =
                serviceTrpcClient.chatMessage.getUserChatMessages.query();
            const [remoteQuizzes, remoteMessages] = await Promise.all([
                remoteQuizzesPromise,
                remoteMessagesPromise,
            ]);
            const remoteQuizIds = new Set(remoteQuizzes.map((q) => q.id));
            const remoteMessageIds = new Set(remoteMessages.map((m) => m.id));
            console.log(
                `[SYNC] Fetched ${remoteQuizzes.length} remote quizzes and ${
                    remoteMessages.length
                } remote messages in ${Date.now() - remoteFetchStartTime}ms.`
            );

            // --- 2. Fetch Local Data ---
            const localFetchStartTime = Date.now();
            const localQuizzes = await quizRepository.getAll();
            const localMessages = await chatMessageRepository.getAll();
            console.log(
                `[SYNC] Fetched ${localQuizzes.length} local quizzes and ${
                    localMessages.length
                } local messages in ${Date.now() - localFetchStartTime}ms.`
            );

            // --- 3. Identify and Upload Local-Only Quizzes CONCURRENTLY ---
            const quizzesToUpload = localQuizzes.filter(
                (lq) => !remoteQuizIds.has(lq.id)
            );
            console.log(
                `[SYNC] Found ${quizzesToUpload.length} local-only quizzes to upload.`
            );

            if (quizzesToUpload.length > 0) {
                const quizUploadStartTime = Date.now();
                const quizUploadPromises: Promise<string>[] = quizzesToUpload.map(
                    (quiz) => this.uploadQuiz(quiz) // Pass quiz data
                );

                // Wait for all quiz uploads to settle (succeed or fail)
                const quizUploadResults = await Promise.allSettled(quizUploadPromises);
                console.log(
                    `[SYNC] Quiz uploads settled in ${Date.now() - quizUploadStartTime}ms.`
                );

                // Process results
                quizUploadResults.forEach((result, index) => {
                    const quizId = quizzesToUpload[index]?.id;
                    if (result.status === "fulfilled") {
                        successfullyUploadedQuizIds.add(result.value); // Store successful IDs
                        uploadedQuizzes++;
                    } else {
                        failedQuizUploads++;
                        console.error(
                            `[SYNC] Failed to upload Quiz ${quizId}:`,
                            result.reason
                        );
                    }
                });
                console.log(
                    `[SYNC] Quiz Upload Results: ${uploadedQuizzes} succeeded, ${failedQuizUploads} failed.`
                );
            } else {
                console.log("[SYNC] No new quizzes to upload.");
            }

            // --- 4. Identify and Upload Valid Local-Only Messages CONCURRENTLY ---
            const messagesToUpload = localMessages.filter(
                (lm) => !remoteMessageIds.has(lm.id)
            );

            // Filter further: only upload messages whose parent quiz now exists remotely
            const messagesToAttemptUpload = messagesToUpload.filter((lm) => {
                const quizExistsRemotely = remoteQuizIds.has(lm.quizId);
                const quizUploadedSuccessfully = successfullyUploadedQuizIds.has(
                    lm.quizId
                );
                if (quizExistsRemotely || quizUploadedSuccessfully) {
                    return true;
                } else {
                    skippedMessages++;
                    // Only log if there were failed quiz uploads to avoid noise
                    if (failedQuizUploads > 0) {
                        console.warn(
                            `[SYNC] Skipping message ${lm.id} because its quiz ${lm.quizId} failed to upload or doesn't exist remotely.`
                        );
                    }
                    return false;
                }
            });

            console.log(
                `[SYNC] Found ${messagesToUpload.length} total local-only messages.`
            );
            console.log(
                `[SYNC] Attempting to upload ${messagesToAttemptUpload.length} messages (skipped ${skippedMessages}).`
            );

            if (messagesToAttemptUpload.length > 0) {
                const messageUploadStartTime = Date.now();
                const messageUploadPromises: Promise<string>[] =
                    messagesToAttemptUpload.map((message) =>
                        this.uploadChatMessage(message)
                    );

                // Wait for all message uploads to settle
                const messageUploadResults = await Promise.allSettled(
                    messageUploadPromises
                );
                console.log(
                    `[SYNC] Message uploads settled in ${
                        Date.now() - messageUploadStartTime
                    }ms.`
                );

                // Process results
                messageUploadResults.forEach((result, index) => {
                    const messageId = messagesToAttemptUpload[index]?.id;
                    if (result.status === "fulfilled") {
                        uploadedMessages++;
                    } else {
                        failedMessageUploads++;
                        console.error(
                            `[SYNC] Failed to upload Message ${messageId}:`,
                            result.reason
                        );
                    }
                });
                console.log(
                    `[SYNC] Message Upload Results: ${uploadedMessages} succeeded, ${failedMessageUploads} failed.`
                );
            } else {
                console.log("[SYNC] No new valid messages to upload.");
            }

            // --- 5. Update Local Dexie with Remote Data ---
            const dexieUpdateStartTime = Date.now();
            // This part remains the same - ensures local state matches remote after sync attempt
            if (remoteQuizzes.length > 0) {
                const quizzesForDexie = remoteQuizzes.map((q) => ({
                    ...q,
                    status: "done" as const,
                }));
                await quizRepository.bulkCreateOrUpdate(quizzesForDexie);
            }
            if (remoteMessages.length > 0) {
                const messagesForDexie = remoteMessages.map((m) => ({
                    ...m,
                    status: "done" as const,
                }));
                await chatMessageRepository.bulkCreateOrUpdate(messagesForDexie);
            }
            console.log(
                `[SYNC] Updated local Dexie with ${remoteQuizzes.length} quizzes and ${
                    remoteMessages.length
                } messages from remote in ${Date.now() - dexieUpdateStartTime}ms.`
            );

            const totalTime = Date.now() - startTime;
            console.log(`[SYNC] Bulk sync completed in ${totalTime}ms.`);
            return {
                uploadedQuizzes,
                failedQuizUploads,
                uploadedMessages,
                failedMessageUploads,
                skippedMessages,
                downloadedQuizzes: remoteQuizzes.length,
                downloadedMessages: remoteMessages.length,
            };
        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`[SYNC ERROR] Bulk sync failed after ${totalTime}ms:`, error);
            // Return error state or re-throw
            throw error; // Re-throwing allows the hook to catch it
        }
    }
}

// Export a singleton instance
const syncService = new SyncService();
export default syncService;
