// src/app/_components/quiz-sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Brain, LogOut, PlusCircle, LogIn } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Separator } from "./ui/separator";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { v4 as uuidv4 } from "uuid";
import {type Quiz} from "~/types/Quiz";
import {db} from "~/db/dexie";

export function QuizSidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const { data: session } = useSession();
    const router = useRouter();

    const [quizzes, setQuizzes] = useState<Quiz[]>([]);

    const createQuiz = api.quiz.create.useMutation({
        onSuccess: (newQuiz: Quiz) => {
            // Upon successful creation on the server, you might want to ensure Dexie is reloaded.
            // For now, simply navigate to the quiz route.
            router.push(`/quiz/${newQuiz.id}`);
        },
        onError: error => {
            console.error("Error creating quiz on the server:", error);
        }
    })

    useEffect(() => {
        const loadQuizzes = async () => {
            try {
                const stored = await db.quizzes.toArray();
                setQuizzes(stored);
            } catch (err) {
                console.error("Error fetching quizzes from Dexie", err);
            }
        };
        void loadQuizzes();
    }, [])

    const reloadQuizzes = async () => {
        try {
            const stored = await db.quizzes.toArray();
            setQuizzes(stored);
        } catch (err) {
            console.error("Error reloading quizzes from Dexie", err);
        }
    };

    // When the user clicks New Study Session, we:
    // 1. Generate a new quizId.
    // 2. Immediately create a new quiz record in Dexie.
    // 3. Navigate to /quiz/{quizId}.
    // 4. If a user is authenticated, trigger a tRPC mutation to persist the quiz on the server.
    const handleNewQuiz = async () => {
        // Generate new quiz ID on button click.
        const newQuizId: string = uuidv4();

        // Create a new quiz object following our shared type.
        const newQuiz: Quiz = {
            id: newQuizId,
            title: "New Quiz",
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
        };

        try {
            await db.quizzes.put(newQuiz);
            // Update local state.
            await reloadQuizzes();
        } catch (error) {
            console.error("Failed to save quiz to Dexie", error);
        }

        router.push(`/quiz/${newQuizId}`);

        if (session?.user?.id) {
            createQuiz.mutate({ id: newQuizId, title: newQuiz.title });
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div
                className={cn(
                    "flex items-center p-4 border-b",
                    isCollapsed ? "justify-center" : "justify-between"
                )}
            >
                {isCollapsed ? (
                    <Brain className="h-6 w-6 text-primary" />
                ) : (
                    <div className="flex items-center">
                        <Brain className="h-6 w-6 text-primary mr-2" />
                        <h1 className="text-xl font-bold">Askova</h1>
                    </div>
                )}
            </div>

            {/* New Study Session Button */}
            <div
                className={cn(
                    "p-4 flex flex-col gap-2",
                    isCollapsed && "items-center"
                )}
            >
                <Button
                    variant="outline"
                    onClick={handleNewQuiz}
                    className={cn(isCollapsed ? "w-8 h-8 p-0" : "w-full justify-start")}
                >
                    <PlusCircle className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                    {!isCollapsed && <span>New Study Session</span>}
                </Button>
            </div>

            {/* List of Quizzes */}
            <div
                className={cn("p-4 flex-1 overflow-y-auto", isCollapsed && "items-center")}
            >
                {quizzes?.map((quiz) => (
                    <Button
                        key={quiz.id}
                        variant="ghost"
                        onClick={() => router.push(`/quiz/${quiz.id}`)}
                        className={cn("w-full justify-start mb-2", isCollapsed && "w-8 h-8 p-0")}
                    >
                        <span className="text-sm">{quiz.title}</span>
                    </Button>
                ))}
            </div>

            <Separator />

            {/* Authentication Section */}
            <div className="p-4">
                {session ? (
                    <Button
                        variant="outline"
                        onClick={() => signOut()}
                        className={cn(isCollapsed ? "w-8 h-8 p-0" : "w-full justify-start")}
                    >
                        <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && <span>Logout</span>}
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        onClick={() => signIn()}
                        className={cn(isCollapsed ? "w-8 h-8 p-0" : "w-full justify-start")}
                    >
                        <LogIn className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && <span>Login / Sign Up</span>}
                    </Button>
                )}
            </div>
        </div>
    );
}
