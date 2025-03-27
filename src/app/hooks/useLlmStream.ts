// src/app/hooks/useLlmStream.ts
import { useRef, useCallback } from "react";

// Type for the data expected by the SSE API endpoint
interface StreamPayload {
    history: Array<{ role: string; content: string }>;
    latestUserMessageContent: string;
    // Add other payload fields if needed by your API (e.g., quizId for logging)
}


// Type for the callbacks the hook will use to communicate with the component
interface UseLlmStreamCallbacks {
    onChunkReceived: (messageId: string, chunk: string) => Promise<void>;
    onStreamComplete: (messageId: string) => Promise<void>;
    onStreamError: (
        messageId: string,
        errorMessage: string, // Pass the specific error message string
        errorDetails?: unknown // Optional: pass raw error for logging
    ) => Promise<void>;
    // Optional: Add onStreamStart, onStreamAbort if needed by component
}

// Helper to check if an object is a valid SSE error structure
interface SseErrorData {
    message: string;
}
function isSseErrorData(obj: unknown): obj is SseErrorData {
    return typeof obj === "object" && obj !== null && "message" in obj;
}



export function useLlmStream(
    apiUrl: string,
    callbacks: UseLlmStreamCallbacks
) {
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Internal Stream Processing Logic (Moved from QuizInterface) ---
    const processStreamInternal = useCallback(
        async (
            reader: ReadableStreamDefaultReader<Uint8Array>,
            decoder: TextDecoder,
            messageId: string // The ID of the AI message being updated
        ) => {
            let buffer = "";
            const { onChunkReceived, onStreamComplete, onStreamError } =
                callbacks;

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log(
                            `[useLlmStream] Stream finished for ${messageId}.`
                        );
                        // Ensure completion callback is called even if 'done' event wasn't explicitly sent
                        await onStreamComplete(messageId);
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    let boundary = buffer.indexOf("\n\n");

                    while (boundary !== -1) {
                        const message = buffer.substring(0, boundary);
                        buffer = buffer.substring(boundary + 2);

                        if (message.startsWith("event: done")) {
                            console.log(
                                `[useLlmStream] Received done event for ${messageId}.`
                            );
                            await onStreamComplete(messageId);
                            // Don't break here, allow loop to finish naturally
                        } else if (message.startsWith("event: error")) {
                            const dataLine = message
                                .split("\n")
                                .find((l) => l.startsWith("data: "));
                            let displayErrorMessage =
                                "An error occurred while generating the response.";
                            let errorDetails: unknown = null;

                            if (dataLine) {
                                const errorJson = dataLine.substring(6);
                                try {
                                    const parsedErrorData = JSON.parse(
                                        errorJson
                                    ) as unknown;
                                    errorDetails = parsedErrorData; // Store raw error data
                                    if (isSseErrorData(parsedErrorData)) {
                                        console.error(
                                            `[useLlmStream] Received error event for ${messageId}:`,
                                            parsedErrorData
                                        );
                                        if (
                                            parsedErrorData.message.includes(
                                                "SAFETY"
                                            )
                                        ) {
                                            displayErrorMessage =
                                                "The response could not be generated due to safety guidelines. Please try rephrasing your input or asking a different question.";
                                        } else {
                                            displayErrorMessage = `LLM Error: ${
                                                parsedErrorData.message
                                                    .split(":")
                                                    .slice(-1)[0]
                                                    ?.trim() ?? "Unknown issue"
                                            }`;
                                        }
                                    } else {
                                        console.error(
                                            `[useLlmStream] Received error event with unexpected structure for ${messageId}:`,
                                            parsedErrorData
                                        );
                                        displayErrorMessage =
                                            "Received a malformed error from the server.";
                                    }
                                } catch (e) {
                                    errorDetails = e;
                                    console.error(
                                        `[useLlmStream] Error parsing error JSON for ${messageId}:`,
                                        e,
                                        errorJson
                                    );
                                    displayErrorMessage =
                                        "Failed to understand the error from the server.";
                                }
                            } else {
                                displayErrorMessage =
                                    "Received an unspecified error from the server.";
                            }
                            await onStreamError(
                                messageId,
                                displayErrorMessage,
                                errorDetails
                            );
                            return; // Stop processing on error event
                        } else if (message.startsWith("data: ")) {
                            const dataJson = message.substring(6);
                            try {
                                const parsedData = JSON.parse(
                                    dataJson
                                ) as unknown;
                                if (typeof parsedData === "string") {
                                    // Call the component's callback to handle the chunk
                                    await onChunkReceived(
                                        messageId,
                                        parsedData
                                    );
                                } else {
                                    console.warn(
                                        `[useLlmStream] Received non-string data chunk for ${messageId}:`,
                                        parsedData
                                    );
                                }
                            } catch (e) {
                                console.error(
                                    `[useLlmStream] Error parsing data JSON for ${messageId}:`,
                                    e,
                                    dataJson
                                );
                                // Decide if this should trigger onStreamError or just be logged
                            }
                        }
                        boundary = buffer.indexOf("\n\n");
                    }
                }
            } catch (error) {
                // Handle read errors or aborts
                let errorMsg = "Stream reading failed";
                if ((error as Error).name === "AbortError") {
                    console.log(
                        `[useLlmStream] Stream fetch aborted for ${messageId}.`
                    );
                    errorMsg = "Stream cancelled";
                    // Optionally call an onAbort callback if provided
                } else {
                    console.error(
                        `[useLlmStream] Error reading stream for ${messageId}:`,
                        error
                    );
                }
                // Call the component's error handler
                await onStreamError(messageId, errorMsg, error);
            } finally {
                reader.releaseLock();
                // Note: No internal status setting here. Component manages its state.
            }
        },
        [callbacks] // Depend on the callback object
    );

    // --- Function to Start the Stream ---
    const startStream = useCallback(
        async (payload: StreamPayload, messageId: string) => {
            // Abort any existing stream before starting a new one
            if (abortControllerRef.current) {
                console.log("[useLlmStream] Aborting previous stream request.");
                abortControllerRef.current.abort();
            }

            // Create a new AbortController for this request
            const controller = new AbortController();
            abortControllerRef.current = controller;

            try {
                // Component managing 'connecting' state can be done here if needed via callback
                // e.g., if (callbacks.onStreamStart) await callbacks.onStreamStart(messageId);

                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    let errorText = "API request failed";
                    try {
                        errorText = await response.text();
                    } catch (_) {
                        /* ignore */
                    }
                    const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
                    throw new Error(errorMessage); // Throw to be caught below
                }

                if (!response.body) {
                    throw new Error("Response body is null");
                }

                // Component managing 'streaming' state can be done here if needed via callback

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                // Start processing in the background - DO NOT await this
                void processStreamInternal(reader, decoder, messageId);
            } catch (error) {
                let errorMsg = "Failed to start stream";
                if ((error as Error).name === "AbortError") {
                    console.log(
                        `[useLlmStream] Initial fetch aborted for ${messageId}.`
                    );
                    errorMsg = "Request cancelled";
                    // Optionally call an onAbort callback if provided
                } else {
                    console.error(
                        `[useLlmStream] Failed to start stream for ${messageId}:`,
                        error
                    );
                    errorMsg =
                        error instanceof Error ? error.message : String(error);
                }
                // Call the component's error handler
                await callbacks.onStreamError(messageId, errorMsg, error);
            }
        },
        [apiUrl, processStreamInternal, callbacks] // Dependencies
    );

    // --- Function to Manually Abort the Stream ---
    const abortStream = useCallback(() => {
        if (abortControllerRef.current) {
            console.log("[useLlmStream] Manually aborting stream.");
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            // Component managing 'aborted' state can be done here if needed via callback
        }
    }, []);

    // Optional: Cleanup function to abort on unmount
    // useEffect(() => {
    //     return () => {
    //         abortStream();
    //     };
    // }, [abortStream]);

    return { startStream, abortStream };
}
