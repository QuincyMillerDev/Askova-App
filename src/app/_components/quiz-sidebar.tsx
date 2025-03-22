// src/app/_components/quiz-sidebar.tsx
"use client";

import { Button } from "./ui/button";
import { Brain, LogOut, PlusCircle, LogIn } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Separator } from "./ui/separator";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";

export function QuizSidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const { data: session } = useSession();
    const router = useRouter();

    const handleNewQuiz = async () => {
        router.push(`/quiz`);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div
                onClick={() => router.push("/quiz")}
                className="flex items-center justify-center p-4 border-b cursor-pointer"
            >
                <Brain className={cn("h-6 w-6 text-primary", !isCollapsed && "mr-2")} />
                {!isCollapsed && (
                    <h1 className="text-xl font-bold">Askova</h1>
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
                    className={cn(
                        isCollapsed ? "w-8 h-8 p-0" : "w-full justify-start"
                    )}
                >
                    <PlusCircle
                        className={cn("h-4 w-4", !isCollapsed && "mr-2")}
                    />
                    {!isCollapsed && <span>New Study Session</span>}
                </Button>
            </div>

            {/* List of Quizzes */}
            <div
                className={cn(
                    "p-4 flex-1 overflow-y-auto",
                    isCollapsed && "items-center"
                )}
            >
                {/*{quizzes?.map((quiz) => (
          <Button
              key={quiz.id}
              variant="ghost"
              onClick={() => router.push(`/quiz/${quiz.id}`)}
              className={cn(
                "w-full justify-start mb-2",
                isCollapsed && "w-8 h-8 p-0"
              )}
          >
              <span className="text-sm">{quiz.title}</span>
          </Button>
        ))}*/}
            </div>

            <Separator />

            {/* Authentication Section */}
            <div className="p-4">
                {session ? (
                    <Button
                        variant="outline"
                        onClick={() => signOut()}
                        className={cn(
                            isCollapsed ? "w-8 h-8 p-0" : "w-full justify-start"
                        )}
                    >
                        <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && <span>Logout</span>}
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        onClick={() => signIn()}
                        className={cn(
                            isCollapsed ? "w-8 h-8 p-0" : "w-full justify-start"
                        )}
                    >
                        <LogIn className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && <span>Login / Sign Up</span>}
                    </Button>
                )}
            </div>
        </div>
    );
}
