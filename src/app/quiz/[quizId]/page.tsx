// src/app/quiz/[quizId]/page.tsx
import { QuizLayout } from "../../_components/quiz-layout";
import { QuizSidebar } from "../../_components/quiz-sidebar";
import QuizPageClient from "./quiz-page-client";

type QuizPageProps = { params: { quizId: string } };

export default async function QuizPage({ params }: QuizPageProps) {
    const { quizId } = await Promise.resolve(params);

    return (
        <QuizLayout
            sidebar={<QuizSidebar />}
            content={<QuizPageClient quizId={quizId} />}
        />
    );
}
