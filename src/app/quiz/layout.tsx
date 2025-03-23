// src/app/quiz/layout.tsx
"use client";

import React, { type ReactNode } from "react";
import { SidebarProvider } from "~/app/_components/contexts/sidebar-context";
import { QuizSidebar } from "~/app/_components/quiz/quiz-sidebar";
import { QuizSidebarToggleButton } from "~/app/_components/quiz/quiz-sidebar-toggle";
import { QuizLayout } from "~/app/_components/quiz/quiz-layout";

interface QuizLayoutProps {
    children: ReactNode;
}

export default function QuizSharedLayout({ children }: QuizLayoutProps) {
    return (
        <SidebarProvider>
            <QuizSidebarToggleButton />
            <QuizLayout sidebar={<QuizSidebar />} content={children} />
        </SidebarProvider>
    );
}
