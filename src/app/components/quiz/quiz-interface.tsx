"use client"

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "~/lib/utils"
import { type ChatMessage, db } from "~/db/dexie"
import { QuizInput } from "~/app/components/quiz/quiz-input"
import { useLiveQuery } from "dexie-react-hooks"
import { useSendChatMessage } from "~/app/hooks/useSendChatMessage"
import { useLLMStreaming } from "~/app/hooks/useLLMStreaming"
import { v4 as uuidv4 } from "uuid"
import { ChatMessageService } from "~/server/services/chatMessageService"
import { ChatMessageItem } from "./chat-message-item"

interface QuizInterfaceProps {
    quizId: string
}

export function QuizInterface({ quizId }: QuizInterfaceProps) {
    const [input, setInput] = useState("")
    const [isLoaded, setIsLoaded] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const initialTriggeredRef = useRef(false)
    const { sendMessageAndUpdate } = useSendChatMessage()
    const { startStreaming, isStreaming, error: streamError } = useLLMStreaming()

    const liveMessages: ChatMessage[] | undefined = useLiveQuery(
        () => db.chatMessages.where("quizId").equals(quizId).sortBy("createdAt"),
        [quizId],
    )

    const localMessages: ChatMessage[] = useMemo(() => liveMessages ?? [], [liveMessages])

    // --- Effects ---
    useEffect(() => {
        setIsLoaded(false)
        initialTriggeredRef.current = false
        const timer = setTimeout(() => setIsLoaded(true), 50)
        return () => clearTimeout(timer)
    }, [quizId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [localMessages])

    // --- Function to Create AI Placeholder and Start Streaming ---
    const createPlaceholderAndStream = useCallback(
        async (userMessage: ChatMessage, historyForLLM: ChatMessage[]) => {
            // Only prevent if a stream is *actively* running
            if (isStreaming) {
                console.warn(`[Quiz Interface] Streaming already active for quiz ${quizId}. Skipping new stream request.`)
                return
            }

            console.log(
                `[Quiz Interface] Creating placeholder and starting stream for quiz ${quizId} after user message ${userMessage.id}`,
            )
            const modelMessageId = uuidv4()
            const modelMessagePlaceholder: ChatMessage = {
                id: modelMessageId,
                quizId: quizId,
                role: "model",
                content: "",
                createdAt: new Date(userMessage.createdAt.getTime() + 1),
                status: "waiting",
            }

            try {
                await ChatMessageService.addOrUpdateLocalMessage(modelMessagePlaceholder)
                console.log(`[Quiz Interface] Saved placeholder ${modelMessageId} with status 'waiting'.`)

                const streamingOptions = {
                    history: historyForLLM.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                    })),
                    latestUserMessageContent: userMessage.content,
                    correlationId: modelMessageId,
                }

                void startStreaming(streamingOptions) // Use void, don't await full stream
                console.log(`[Quiz Interface] Called startStreaming for ${modelMessageId}.`)
            } catch (error) {
                console.error("[Quiz Interface] Error creating placeholder or starting stream:", error)
                await ChatMessageService.updateLocalMessageStatus(modelMessageId, "error", "Failed to initiate AI response.")
            }
        },
        [quizId, startStreaming, isStreaming],
    )

    // --- Effect to Trigger Initial AI Response ---
    useEffect(() => {
        // Check if a model message already exists in the current set
        const modelMessageExists = localMessages.some((m) => m.role === "model")

        // Conditions to trigger:
        // 1. Messages loaded
        // 2. Exactly one message
        // 3. Message is from 'user'
        // 4. No model message exists yet
        // 5. Initial trigger ref is false
        // 6. Not currently streaming
        if (
            liveMessages &&
            localMessages.length === 1 &&
            localMessages[0]?.role === "user" &&
            !modelMessageExists &&
            !initialTriggeredRef.current &&
            !isStreaming
        ) {
            console.log(`[Quiz Interface Effect] Triggering initial AI response for quiz ${quizId}`)
            initialTriggeredRef.current = true
            const userMessage = localMessages[0]
            const historyForLLM = [userMessage]
            void createPlaceholderAndStream(userMessage, historyForLLM)
        }
    }, [liveMessages, localMessages, quizId, isStreaming, createPlaceholderAndStream])

    // --- handleSubmit for User Messages ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const trimmedInput = input.trim()
        if (!trimmedInput || !quizId || isStreaming) return

        const userMessageId = uuidv4()
        const userMessage: ChatMessage = {
            id: userMessageId,
            quizId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
            status: "done",
        }

        setInput("")

        try {
            await sendMessageAndUpdate(userMessage)
            // Prepare history *including* the new user message
            const currentHistory = liveMessages ?? []
            const historyForLLM = [...currentHistory, userMessage]

            // Trigger AI response
            void createPlaceholderAndStream(userMessage, historyForLLM)
        } catch (error) {
            console.error("Error saving user message or triggering AI response:", error)
        }
    }

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 relative w-full">
                <ScrollArea className="h-full w-full">
                    <div
                        className={cn(
                            "mx-auto max-w-4xl space-y-6 p-4 pb-36 transition-opacity duration-150",
                            isLoaded ? "opacity-100" : "opacity-0",
                        )}
                    >
                        {localMessages.map((message) => (
                            <ChatMessageItem key={message.id} message={message} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {streamError && (
                    <div className="absolute bottom-24 left-0 right-0 mx-auto max-w-4xl px-4">
                        <p className="text-center text-xs text-destructive">Stream Error: {streamError}</p>
                    </div>
                )}

                <QuizInput
                    input={input}
                    onInputChange={(e) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    isTyping={isStreaming}
                    disabled={!quizId || !isLoaded || isStreaming}
                />
            </div>
        </div>
    )
}
