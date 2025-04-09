// src/hooks/useLLMStreaming.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChatMessageService } from "~/server/services/chatMessageService";
import syncService from "~/server/services/syncService";

interface StreamingOptions {
    history: Array<{ role: "user" | "model"; content: string }>;
    latestUserMessageContent: string;
    correlationId: string; // ID of the placeholder message to update
}

interface UseLLMStreamingResult {
    error: string | null;
    isStreaming: boolean;
    startStreaming: (options: StreamingOptions) => Promise<void>; // Expose function to start
    cancelStreaming: () => void; // Expose function to cancel
}

// Helper function to safely extract error message
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "An unknown error occurred";
}

export function useLLMStreaming(): UseLLMStreamingResult {
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
        null
    ); // Ref to hold the reader for cleanup
    const { data: session } = useSession();
    const isAuthenticated = !!session?.user?.id;

    const cancelStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort(); // This will cause the fetch to throw an AbortError
            console.log("[Streaming Hook] Abort signal sent.");
        }
        // We don't need to manually cancel the reader here,
        // the AbortError being caught should handle cleanup.
    }, []);

    const startStreaming = useCallback(
        async (options: StreamingOptions) => {
            if (isStreaming) {
                console.warn("[Streaming Hook] Already streaming, ignoring request.");
                return;
            }

            setIsStreaming(true);
            setError(null);
            abortControllerRef.current = new AbortController();
            readerRef.current = null; // Reset reader ref
            const { signal } = abortControllerRef.current;
            const { correlationId } = options;

            console.log(
                `[Streaming Hook] Starting stream for correlationId: ${correlationId}`
            );

            try {
                const response = await fetch("/api/llm-stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(options),
                    signal,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `API request failed with status ${response.status}: ${errorText}`
                    );
                }

                if (!response.body) {
                    throw new Error("No response stream available");
                }

                // Assign reader to the ref
                readerRef.current = response.body.getReader();
                const reader = readerRef.current; // Use local variable for convenience

                const decoder = new TextDecoder("utf-8");
                let done = false;
                let accumulatedText = "";

                while (!done) {
                    // Abort check removed here, handled by fetch throwing AbortError

                    let value: Uint8Array | undefined;
                    let streamDone = false;

                    try {
                        // Reading can throw if the stream is cancelled abruptly
                        ({ value, done: streamDone } = await reader.read());
                    } catch (readError) {
                        // If reader.read() throws (e.g., due to cancellation), treat it like other errors
                        console.warn("[Streaming Hook] Error during reader.read():", readError);
                        throw readError; // Re-throw to be caught by the main catch block
                    }

                    done = streamDone;

                    if (value) {
                        accumulatedText += decoder.decode(value, { stream: true });
                        let boundaryIndex;
                        while ((boundaryIndex = accumulatedText.indexOf("\n\n")) >= 0) {
                            const message = accumulatedText.slice(0, boundaryIndex);
                            accumulatedText = accumulatedText.slice(boundaryIndex + 2);

                            if (!message.trim()) continue;

                            // --- (SSE Parsing Logic - remains the same) ---
                            let eventType = "message";
                            let eventData = "";
                            const lines = message.split("\n");
                            for (const line of lines) {
                                if (line.startsWith("event:")) {
                                    eventType = line.replace(/^event:\s*/, "").trim();
                                } else if (line.startsWith("data:")) {
                                    eventData = line.replace(/^data:\s*/, "");
                                }
                            }

                            if (eventType === "message" && eventData) {
                                try {
                                    const parsedData: unknown = JSON.parse(eventData);
                                    if (typeof parsedData === "string") {
                                        await ChatMessageService.appendLocalMessageContent(
                                            correlationId,
                                            "streaming",
                                            parsedData
                                        );
                                    } else { /* ... warn ... */ }
                                } catch (parseError) { /* ... error ... */ }
                            } else if (eventType === "done") {
                                console.log(`[Streaming Hook] Received 'done' event for ${correlationId}. Finalizing.`);
                                await ChatMessageService.updateLocalMessageStatus(correlationId, "done");
                                setIsStreaming(false); // Set streaming false *before* sync

                                // --- (Background Sync Logic - remains the same) ---
                                if (isAuthenticated) {
                                    try {
                                        const finalMessage = await ChatMessageService.getLocalMessageById(correlationId);
                                        if (finalMessage && finalMessage.status === "done") {
                                            console.log(`[Streaming Hook] Triggering background sync for completed message ${correlationId}`);
                                            syncService.uploadChatMessage(finalMessage).catch((syncError) => {
                                                console.error(`[Streaming Hook] Background sync failed for message ${correlationId}:`, syncError);
                                            });
                                        } else { /* ... warn ... */ }
                                    } catch (fetchError) { /* ... error ... */ }
                                } else { /* ... log skip ... */ }
                                // Loop will naturally exit as 'done' will be true on next iteration if stream ended
                            } else if (eventType === "error") {
                                console.error(`[Streaming Hook] Received 'error' event for ${correlationId}:`, eventData);
                                let errorMessage = "LLM Streaming Error";
                                try {
                                    const errorPayload: unknown = JSON.parse(eventData);
                                    if (typeof errorPayload === "object" && errorPayload !== null && "message" in errorPayload && typeof errorPayload.message === "string") {
                                        errorMessage = errorPayload.message;
                                    } else { /* ... warn ... */ }
                                } catch (parseError) { /* ... error ... */ }
                                // Throw error to be handled by main catch
                                throw new Error(errorMessage);
                            }
                            // --- (End SSE Parsing Logic) ---
                        } // end while(boundaryIndex)
                    } // end if(value)
                } // end while(!done)

                if (accumulatedText.trim()) {
                    console.warn(
                        `[Streaming Hook] Unprocessed text remaining in buffer for ${correlationId}:`,
                        accumulatedText
                    );
                }

                // No explicit reader.cancel() needed here if loop finishes normally
            } catch (e: unknown) {
                const message = getErrorMessage(e);

                // Check specifically for AbortError
                if (e instanceof DOMException && e.name === 'AbortError') {
                    console.log(`[Streaming Hook] Fetch aborted for ${correlationId}.`);
                    setError("Stream cancelled by user."); // Set specific user-facing error
                    // Update Dexie message status if it was still streaming
                    if (isStreaming) {
                        await ChatMessageService.updateLocalMessageStatus(
                            correlationId,
                            "error",
                            "Stream cancelled by user."
                        );
                    }
                } else {
                    // Handle other errors (network, parsing, LLM error event, read errors)
                    console.error(`[Streaming Hook] Error during streaming for ${correlationId}:`, e);
                    setError(message);
                    // Update Dexie message status to error, using the extracted message
                    if (isStreaming) { // Avoid overwriting 'done' status
                        await ChatMessageService.updateLocalMessageStatus(
                            correlationId,
                            "error",
                            message // Store the specific error message
                        );
                    }
                }
            } finally {
                // --- Cleanup ---
                // Ensure state is reset
                setIsStreaming(false);
                // Release the lock on the stream reader if it exists
                if (readerRef.current) {
                    try {
                        // Check if it's already closed before cancelling - using the promise correctly
                        // readerRef.current.closed.then(() => {
                        //     console.log("[Streaming Hook] Reader was already closed.");
                        // }).catch(async () => {
                        //     // If closed promise rejects or is pending, try cancelling
                        //     console.log("[Streaming Hook] Attempting final reader cancellation.");
                        //     await readerRef.current?.cancel();
                        // });
                        // Simpler: Just cancel, it's okay if already closed/closing
                        await readerRef.current.cancel();
                        console.log("[Streaming Hook] Reader cancelled in finally block.");
                    } catch (cancelError) {
                        console.warn("[Streaming Hook] Error during final reader cancellation:", cancelError);
                    }
                }
                // Clear refs
                readerRef.current = null;
                abortControllerRef.current = null;
                console.log(
                    `[Streaming Hook] Stream processing finished for ${correlationId}.`
                );
            }
        },
        [isStreaming, isAuthenticated]
    );

    useEffect(() => {
        // Cleanup effect: Call cancelStreaming when component unmounts
        return () => {
            cancelStreaming();
        };
    }, [cancelStreaming]); // Depend on the memoized cancel function

    return { error, isStreaming, startStreaming, cancelStreaming };
}