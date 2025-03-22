import { QuizLayout } from "../_components/quiz-layout";
import { QuizSidebar } from "../_components/quiz-sidebar";
import { QuizWelcome } from "../_components/quiz-welcome";
import { SidebarProvider } from "../sidebar-context";
import { QuizSidebarToggleButton } from "~/app/_components/quiz-sidebar-toggle";

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
