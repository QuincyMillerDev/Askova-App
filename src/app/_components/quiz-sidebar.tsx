// _components/quiz-sidebar.tsx
"use client";

import { Button } from "./ui/button";
import { Brain, LogOut, PlusCircle, LogIn } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Separator } from "./ui/separator";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { v4 as uuidv4 } from "uuid";


// TODO: Pass props in from the parent component

interface QuizSidebarProps {
    isCollapsed?: boolean;
}

export function QuizSidebar({ isCollapsed = false }: QuizSidebarProps) {
    const {data: session } = useSession();
    const router = useRouter();

    const { data: quizzes } = api.quiz.getAll.useQuery(
        undefined,
        { enabled: !!session }
    );
    const createQuiz = api.quiz.create.useMutation({
        onSuccess: (newQuiz) => {
            // navigate to the new quiz session page once created
            router.push(`/quiz/${newQuiz.id}`);
        }
    });

    const handleNewQuiz = () => {
        const newQuizId: string = uuidv4();

        if (session?.user?.id) {
            console.log("Authenticated")
            // Authenticated: Use tRPC mutation to create a persistent quiz.
            createQuiz.mutate({ title: "New Quiz", id: newQuizId });
            // The navigation will happen in onSuccess.
        } else {
            // Unauthenticated: Use the generated cuid as an ephemeral quiz id.
            router.push(`/quiz/${newQuizId}`);
        }
    }

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

            {/* New Study Session */}
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
                {quizzes?.map((quiz) => (
                    <Button
                        key={quiz.id}
                        variant="ghost"
                        onClick={() => router.push(`/quiz/${quiz.id}`)}
                        className={cn(
                            "w-full justify-start mb-2",
                            isCollapsed && "w-8 h-8 p-0"
                        )}
                    >
                        <span className="text-sm">
                            {quiz.title}
                        </span>
                    </Button>
                ))}
            </div>

            <Separator />
            {/* Auth Section */}

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
