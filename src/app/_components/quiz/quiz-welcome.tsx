"use client"

import type React from "react"
import { useState } from "react"
import type { ChangeEvent } from "react"
import { QuizInput } from "./quiz-input"
import { v4 as uuidv4 } from "uuid"
import { useRouter } from "next/navigation"
import { db } from "~/db/dexie"
import { useSession } from "next-auth/react"
import { api } from "~/trpc/react"
import type { Quiz } from "~/types/Quiz"
import type { ChatMessage } from "~/types/ChatMessage"
import { Brain, Sparkles, BookOpen } from "lucide-react"
import {ScrollArea} from "~/app/_components/ui/scroll-area";

export function QuizWelcome() {
    const [inputValue, setInputValue] = useState("")
    const router = useRouter()
    const { data: session } = useSession()

    // tRPC mutation to create a new quiz session on the server.
    const createQuizMutation = api.quiz.create.useMutation()

    const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmedInput = inputValue.trim()
        if (!trimmedInput) return

        // 1. Generate a new quiz session ID.
        const quizId = uuidv4()

        // 2. Build an initial chat message.
        const initialMessage: ChatMessage = {
            id: Date.now(), // Use a temporary id for local display (Dexie auto-generates real IDs if needed)
            sessionId: quizId,
            role: "user",
            content: trimmedInput,
            createdAt: new Date(),
        }

        // 3. Build a quiz session object (to be stored in Dexie).
        const newQuiz: Quiz = {
            id: quizId,
            title: trimmedInput,
            messages: [], // Initially empty (we're storing messages separately)
            userId: session?.user?.id ?? undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        try {
            // Save the new quiz session to Dexie.
            await db.quizzes.put(newQuiz)
            // Also store the initial chat message to Dexie.
            await db.chatMessages.add(initialMessage)
        } catch (error) {
            console.error("Failed to create quiz session locally:", error)
            return
        }

        // 4. If the user is authenticated, also persist the quiz session on the server.
        if (session?.user) {
            try {
                await createQuizMutation.mutateAsync({ id: quizId, title: trimmedInput })
            } catch (error) {
                console.error("Error persisting quiz session on server:", error)
                // Optionally, you could display a nonblocking error message to the user.
            }
        }

        // 5. Navigate to the quiz page.
        router.push(`/quiz/${quizId}`)
    }

    const features = [
        {
            icon: <Brain className="h-5 w-5" />,
            title: "AI-Powered Learning",
            description: "Personalized study sessions that adapt to your needs",
        },
        {
            icon: <Sparkles className="h-5 w-5" />,
            title: "Smart Quizzes",
            description: "Generate quizzes from your notes and study materials",
        },
        {
            icon: <BookOpen className="h-5 w-5" />,
            title: "Knowledge Retention",
            description: "Improve memory with spaced repetition techniques",
        },
    ]

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 relative w-full">
                <ScrollArea className="w-full h-full">
                    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-36">

                        {/* Hero Section */}
                        <div className="relative z-10 flex flex-col items-center text-center mt-8 mb-12">


                            {/* Brain Illustration */}
                            <div className="relative w-48 h-48 my-8">
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full animate-pulse"
                                    style={{ animationDuration: "4s" }}
                                />
                                <div
                                    className="absolute inset-4 bg-gradient-to-tr from-primary/30 to-transparent rounded-full animate-pulse"
                                    style={{ animationDuration: "7s" }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Brain className="h-20 w-20 text-primary" />
                                </div>
                            </div>


                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                                Study Smarter with <span className="text-primary">Askova</span>
                            </h1>

                            <p className="text-lg text-muted-foreground max-w-2xl">
                                Your personal AI study companion that helps you learn faster, remember longer, and understand deeper.
                            </p>

                        </div>

                        {/* Features Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="p-4 rounded-xl bg-background border border-border hover:border-primary/50 hover:shadow-md transition-all duration-300"
                                >
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-base font-semibold mb-1">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="text-center text-muted-foreground mb-8">Get started by entering your study topic below</div>
                    </div>
                </ScrollArea>

                {/* Input positioned exactly like in the quiz-interface */}
                <QuizInput input={inputValue} onInputChange={handleInputChange} onSubmit={handleSubmit} isTyping={false} />
            </div>
        </div>
    )
}

