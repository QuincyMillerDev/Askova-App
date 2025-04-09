"use client"
import { Button } from "../ui/button"
import { Brain, PlusCircle, LogIn, Pin, Trash2, PinOff } from "lucide-react"
import { useSession, signIn } from "next-auth/react"
import { cn } from "~/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { db, type Quiz } from "~/db/dexie"
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar"
import { useState, useEffect } from "react"

// Helper function to categorize quizzes by recency
const categorizeQuizzesByRecency = (quizzes: Quiz[], pinnedIds: Set<string>) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    // Filter pinned quizzes using the pinnedIds Set
    const pinned = quizzes.filter((quiz) => pinnedIds.has(quiz.id));

    // Filter non-pinned quizzes by date
    const nonPinned = quizzes.filter((quiz) => !pinnedIds.has(quiz.id));

    return {
        pinned,
        today: nonPinned.filter((quiz) => new Date(quiz.createdAt) >= today),
        last7Days: nonPinned.filter((quiz) => {
            const date = new Date(quiz.createdAt);
            return date >= last7Days && date < today;
        }),
        last30Days: nonPinned.filter((quiz) => {
            const date = new Date(quiz.createdAt);
            return date >= last30Days && date < last7Days;
        }),
        older: nonPinned.filter((quiz) => new Date(quiz.createdAt) < last30Days),
    };
};

export function QuizSidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [hoveredQuizId, setHoveredQuizId] = useState<string | null>(null);
    const [pinnedQuizIds, setPinnedQuizIds] = useState<Set<string>>(new Set());

    // Extract the current quiz ID from the URL
    const currentQuizId = (/\/quiz\/([^/]+)/.exec(pathname))?.[1] ?? null;

    // Use live query to read all quizzes stored in Dexie sorted by most recent.
    const quizzes: Quiz[] | undefined = useLiveQuery(
        () => db.quizzes.orderBy("createdAt").reverse().toArray(),
        []
    );

    // Load pinned quiz IDs from localStorage on component mount
    useEffect(() => {
        const loadPinnedQuizzes = () => {
            try {
                const storedPinnedQuizzes = localStorage.getItem("pinnedQuizzes");
                if (storedPinnedQuizzes) {
                    try {
                        const parsedData = JSON.parse(storedPinnedQuizzes) as unknown;
                        if (
                            Array.isArray(parsedData) &&
                            parsedData.every(item => typeof item === 'string')
                        ) {
                            setPinnedQuizIds(new Set<string>(parsedData));
                        } else {
                            console.warn("Invalid pinned quizzes format in localStorage");
                        }
                    } catch (error) {
                        console.error("Failed to parse pinned quizzes:", error);
                    }
                }
            } catch (error) {
                console.error("Failed to load pinned quizzes from localStorage:", error);
            }
        };

        loadPinnedQuizzes();
    }, []);

    // Save pinned quiz IDs to localStorage whenever they change
    useEffect(() => {
        if (pinnedQuizIds.size > 0 || localStorage.getItem("pinnedQuizzes")) {
            localStorage.setItem("pinnedQuizzes", JSON.stringify([...pinnedQuizIds]));
        }
    }, [pinnedQuizIds]);

    // Categorize quizzes by recency
    const categorizedQuizzes = quizzes
        ? categorizeQuizzesByRecency(quizzes, pinnedQuizIds)
        : null;

    // Toggle pin status
    const togglePin = (quizId: string) => {
        setPinnedQuizIds((prevPinnedIds) => {
            const newPinnedIds = new Set(prevPinnedIds);
            if (newPinnedIds.has(quizId)) {
                newPinnedIds.delete(quizId);
            } else {
                newPinnedIds.add(quizId);
            }
            return newPinnedIds;
        });
    };

    // Function to render a quiz button with active state and hover actions
    const renderQuizButton = (quiz: Quiz) => {
        const isActive = quiz.id === currentQuizId;
        const isHovered = hoveredQuizId === quiz.id;
        const isPinned = pinnedQuizIds.has(quiz.id);

        return (
            <div
                key={quiz.id}
                className="relative group"
                onMouseEnter={() => setHoveredQuizId(quiz.id)}
                onMouseLeave={() => setHoveredQuizId(null)}
            >
                <Button
                    variant="ghost"
                    onClick={() => router.push(`/quiz/${quiz.id}`)}
                    className={cn(
                        "w-full justify-start h-9 pr-16", // Add right padding for the action buttons
                        isActive &&
                        "bg-primary/10 text-primary font-medium border-l-2 border-primary pl-[7px]"
                    )}
                >
                    <span className="text-sm truncate">{quiz.title ?? "Untitled"}</span>
                </Button>

                {/* Hover actions */}
                <div
                    className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity",
                        isHovered ? "opacity-100" : "opacity-0"
                    )}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePin(quiz.id);
                        }}
                    >
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Delete functionality would go here
                            console.log("Delete quiz:", quiz.id);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    };

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
                        className={cn(
                            "w-full justify-start hover:bg-primary/10 hover:text-primary border-primary/20",
                            pathname === "/quiz" && "bg-primary/10 text-primary"
                        )}
                    >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        <span>New Study Session</span>
                    </Button>
                </div>
            </div>

            {/* List of Quizzes */}
            <div className="px-4 flex-1 overflow-y-auto">
                {quizzes && quizzes.length > 0 ? (
                    <div className="space-y-4">
                        {/* Pinned quizzes */}
                        {categorizedQuizzes?.pinned.length ? (
                            <div>
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center">
                                    <Pin className="h-3 w-3 mr-1" /> Pinned
                                </h3>
                                <div className="space-y-1">
                                    {categorizedQuizzes.pinned.map(renderQuizButton)}
                                </div>
                            </div>
                        ) : null}

                        {/* Today's quizzes */}
                        {categorizedQuizzes?.today.length ? (
                            <div>
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                    Today
                                </h3>
                                <div className="space-y-1">
                                    {categorizedQuizzes.today.map(renderQuizButton)}
                                </div>
                            </div>
                        ) : null}

                        {/* Last 7 days quizzes */}
                        {categorizedQuizzes?.last7Days.length ? (
                            <div>
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                    Last 7 days
                                </h3>
                                <div className="space-y-1">
                                    {categorizedQuizzes.last7Days.map(renderQuizButton)}
                                </div>
                            </div>
                        ) : null}

                        {/* Last 30 days quizzes */}
                        {categorizedQuizzes?.last30Days.length ? (
                            <div>
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                    Last 30 days
                                </h3>
                                <div className="space-y-1">
                                    {categorizedQuizzes.last30Days.map(renderQuizButton)}
                                </div>
                            </div>
                        ) : null}

                        {/* Older quizzes */}
                        {categorizedQuizzes?.older.length ? (
                            <div>
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                    Older
                                </h3>
                                <div className="space-y-1">
                                    {categorizedQuizzes.older.map(renderQuizButton)}
                                </div>
                            </div>
                        ) : null}
                    </div>
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
                        onClick={() => router.push("/settings/account")}
                        className={cn(
                            "w-full justify-start h-12 relative z-10 border-primary/20",
                            pathname?.startsWith("/settings/account") &&
                            "bg-primary/10 text-primary"
                        )}
                    >
                        <Avatar className="h-6 w-6 mr-3">
                            {session.user.image ? (
                                <AvatarImage
                                    src={session.user.image}
                                    alt={session.user.name ?? ""}
                                />
                            ) : (
                                <AvatarFallback className="bg-primary/20 text-primary">
                                    {session.user.name?.[0] ?? "U"}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        <span className="font-medium truncate">
              {session.user.name ?? "Account"}
            </span>
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
    );
}
