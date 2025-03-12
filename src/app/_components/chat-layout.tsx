// _components/chat-layout.tsx
"use client";

import { type ReactNode, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { cn } from "~/lib/utils";

interface ChatDashboardProps {
    sidebar: ReactNode | ((isCollapsed: boolean) => ReactNode);
    content: ReactNode | ((isCollapsed: boolean, toggleSidebar: () => void) => ReactNode);
}

export function ChatLayout({ sidebar, content }: ChatDashboardProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    // Render the sidebar based on whether it's a function or direct ReactNode
    const renderSidebar = (collapsed: boolean) => {
        if (typeof sidebar === 'function') {
            return sidebar(collapsed);
        }
        return sidebar;
    };

    // Render the content and pass collapse state and toggle function
    const renderContent = () => {
        if (typeof content === 'function') {
            return content(isCollapsed, toggleSidebar);
        }
        return content;
    };

    return (
        <div className="flex h-screen w-full overflow-hidden">
            {/* Desktop Sidebar */}
            <div
                className={cn(
                    "hidden md:flex h-full border-r flex-shrink-0 transition-all duration-300 bg-sidebar relative",
                    isCollapsed ? "w-16" : "w-64"
                )}
            >
                <div className="h-full flex flex-col w-full overflow-hidden">
                    {renderSidebar(isCollapsed)}
                </div>
            </div>

            {/* Mobile Sidebar */}
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild className="md:hidden absolute top-3 left-3 z-30">
                    <Button variant="outline" size="icon">
                        <Menu className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0" onClick={() => setIsSidebarOpen(false)}>
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    {renderSidebar(false)}
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative">
                {renderContent()}
            </div>
        </div>
    );
}
