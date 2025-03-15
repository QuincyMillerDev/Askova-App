// _components/quiz-sidebar.tsx
"use client";

import { Button } from "./ui/button";
import { Brain, PlusCircle } from "lucide-react";
import { Separator } from "./ui/separator";
import { cn } from "~/lib/utils";

interface QuizSidebarProps {
    isCollapsed?: boolean;
}

export function QuizSidebar({ isCollapsed = false }: QuizSidebarProps) {
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

            {/* Sidebar Content */}
            <div
                className={cn(
                    "p-4 flex flex-col gap-2 flex-1",
                    isCollapsed && "items-center"
                )}
            >
                <Button
                    variant="outline"
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

            <Separator />
            {/* Auth Section */}

        </div>
    );
}
