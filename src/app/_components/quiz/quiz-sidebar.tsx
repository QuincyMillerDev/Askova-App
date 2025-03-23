// src/app/_components/quiz-sidebar.tsx
"use client";

import React from "react";
import { Button } from "../ui/button";
import { Brain, LogOut, PlusCircle, LogIn } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Separator } from "../ui/separator";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/db/dexie";
import type { Quiz } from "~/types/Quiz";

export function QuizSidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const { data: session } = useSession();
    const router = useRouter();

    // Use live query to read all quizzes stored in Dexie
    const quizzes: Quiz[] | undefined = useLiveQuery(() => db.quizzes.toArray(), []);

    const handleNewQuiz = async () => {
        // Redirect to the new quiz creation page (handled by QuizWelcome)
        router.push(`/quiz`);
    };

    return (
        <div
            className={cn(
                "transition-all duration-100 flex flex-col h-full overflow-hidden",
                isCollapsed ? "w-0" : "w-64"
            )}
        >
            {/* Sidebar Header */}
            <div
                onClick={() => router.push("/quiz")}
                className="flex items-center justify-center p-4 border-b cursor-pointer"
            >
                <Brain className="h-6 w-6 text-primary mr-2" />
                <h1 className="text-xl font-bold">Askova</h1>
            </div>

            {/* New Study Session Button */}
            <div className="p-4 flex flex-col gap-2">
                <Button
                    variant="outline"
                    onClick={handleNewQuiz}
                    className="w-full justify-start"
                >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    <span>New Study Session</span>
                </Button>
            </div>

            {/* List of Quizzes */}
            <div className="p-4 flex-1 overflow-y-auto">
                {quizzes && quizzes.length > 0 ? (
                    quizzes.map((quiz) => (
                        <Button
                            key={quiz.id}
                            variant="ghost"
                            onClick={() => router.push(`/quiz/${quiz.id}`)}
                            className="w-full justify-start mb-2"
                        >
              <span className="text-sm">
                {quiz.title ?? "Untitled"}
              </span>
                        </Button>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground mt-4">
                        No quizzes yet.
                    </div>
                )}
            </div>

            <Separator />

            {/* Authentication Section */}
            <div className="p-4">
                {session ? (
                    <Button
                        variant="outline"
                        onClick={() => signOut()}
                        className="w-full justify-start"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        <span>Logout</span>
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        onClick={() => signIn()}
                        className="w-full justify-start"
                    >
                        <LogIn className="h-4 w-4 mr-2" />
                        <span>Login / Sign Up</span>
                    </Button>
                )}
            </div>
        </div>
    );
}
