// src/app/components/quiz/quiz-layout.tsx
"use client";

import React, { useState } from "react";
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetClose,
    SheetDescription,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { cn } from "~/lib/utils";
import { DialogTitle } from "@radix-ui/react-dialog";
import { useSidebar } from "~/app/components/contexts/sidebar-context";

interface QuizLayoutProps {
    sidebar: React.ReactElement;
    content: React.ReactNode;
}

export function QuizLayout({ sidebar, content }: QuizLayoutProps) {
    const { isCollapsed, toggleSidebar } = useSidebar();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen w-full overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block">
                <div
                    className={cn(
                        "h-full transition-all duration-100 bg-sidebar border-r",
                        isCollapsed ? "w-0" : "w-64"
                    )}
                >
                    {React.cloneElement(sidebar, { isCollapsed })}
                </div>
            </aside>

            {/* Mobile Sidebar */}
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden absolute top-3 left-3 z-30"
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                </SheetTrigger>

                <SheetContent
                    side="left"
                    className="w-64 p-0 transition-transform duration-100"
                >
                    <div className="h-full overflow-y-auto">
                        <DialogTitle className="sr-only">Sidebar</DialogTitle>
                        <SheetDescription className="sr-only">
                            This is the sidebar containing navigation options.
                        </SheetDescription>
                        <SheetClose asChild />
                        {React.cloneElement(sidebar, { isCollapsed: false })}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative">
                {React.isValidElement(content)
                    ? React.cloneElement(
                        // Assert the content accepts the extra properties.
                        content as React.ReactElement<{
                            isCollapsed?: boolean;
                            toggleSidebar?: () => void;
                        }>,
                        { isCollapsed, toggleSidebar }
                    )
                    : content}
            </main>
        </div>
    );
}
