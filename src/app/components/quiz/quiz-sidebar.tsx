"use client"
import { Button } from "../ui/button"
import { Brain, PlusCircle, LogIn } from "lucide-react"
import { useSession, signIn } from "next-auth/react"
import { cn } from "~/lib/utils"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import {db, type Quiz} from "~/db/dexie";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar"

export function QuizSidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const { data: session } = useSession()
    const router = useRouter()

    // Use live query to read all quizzes stored in Dexie sorted by most recent.
    const quizzes: Quiz[] | undefined = useLiveQuery(
        () => db.quizzes.orderBy("createdAt").reverse().toArray(),
        []
    )

    return (
        <div
            className={cn(
                "transition-all duration-100 flex flex-col h-full overflow-hidden",
                isCollapsed ? "w-0" : "w-64"
            )}
        >
            {/* Sidebar Header */}
            <div>
                {/* App Title */}
                <div
                    onClick={() => router.push("/quiz")}
                    className="flex items-center justify-center p-4 cursor-pointer"
                >
                    <Brain className="h-6 w-6 text-primary mr-2" />
                    <h1 className="text-xl font-bold">Askova</h1>
                </div>

                {/* New Study Session Button - Now in header area */}
                <div className="px-4 pb-4">
                    <Button
                        variant="outline"
                        onClick={() => router.push(`/quiz`)}
                        className="w-full justify-start hover:bg-primary/10 hover:text-primary border-primary/20"
                    >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        <span>New Study Session</span>
                    </Button>
                </div>
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
                            <span className="text-sm">{quiz.title ?? "Untitled"}</span>
                        </Button>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground mt-4">
                        No quizzes yet.
                    </div>
                )}
            </div>

            {/* Authentication Section */}
            <div className="p-6 relative">
                {session ? (
                    <Button
                        variant="outline"
                        onClick={() => router.push('/settings/account')}
                        className="w-full justify-start h-12 relative z-10 border-primary/20"
                    >
                        <Avatar className="h-6 w-6 mr-3">
                            {session.user.image ? (
                                <AvatarImage src={session.user.image} alt={session.user.name ?? ""} />
                            ) : (
                                <AvatarFallback className="bg-primary/20 text-primary">
                                    {session.user.name?.[0] ?? "U"}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        <span className="font-medium truncate">{session.user.name ?? "Account"}</span>
                    </Button>
                ) : (
                    <div className="space-y-3">
                        <Button
                            variant="outline"
                            onClick={() => signIn()}
                            className="w-full h-12 justify-start hover:bg-primary/10 hover:text-primary border-primary/20"
                        >
                            <LogIn className="h-5 w-5 mr-3" />
                            <span className="font-medium">Login</span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
