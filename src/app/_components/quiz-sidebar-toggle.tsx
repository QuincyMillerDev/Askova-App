"use client";

import React from "react";
import { Button } from "./ui/button";
import { PanelLeft } from "lucide-react";
import { cn } from "~/lib/utils";
import {useSidebar} from "~/app/sidebar-context";


export const QuizSidebarToggleButton: React.FC = () => {
    const { isCollapsed, toggleSidebar } = useSidebar();

    return (
        <div className="absolute top-3 left-3 z-50">
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={toggleSidebar}
            >
                <PanelLeft
                    className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")}
                />
                <span className="sr-only">Toggle Sidebar</span>
            </Button>
        </div>
    );
};
