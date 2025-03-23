"use client";

import { QuizLayout } from "../_components/quiz/quiz-layout";
import { QuizSidebar } from "../_components/quiz/quiz-sidebar";
import { QuizWelcome } from "../_components/quiz/quiz-welcome";
import { SidebarProvider } from "~/app/_components/contexts/sidebar-context";
import { QuizSidebarToggleButton } from "~/app/_components/quiz/quiz-sidebar-toggle";

export default function Home() {
    return (
            <SidebarProvider>
                <main>
                    <QuizSidebarToggleButton />
                    <QuizLayout sidebar={<QuizSidebar />} content={<QuizWelcome />} />
                </main>
            </SidebarProvider>
    );
}
