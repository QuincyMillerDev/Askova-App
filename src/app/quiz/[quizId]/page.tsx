// src/app/quiz/[quizId]/page.tsx
import { QuizLayout } from "../../_components/quiz-layout";
import { QuizSidebar } from "../../_components/quiz-sidebar";
import QuizPageClient from "./quiz-page-client";

type QuizPageProps = { params: { quizId: string } };

export default async function QuizPage({ params }: QuizPageProps) {
    // This is a server component so it can safely extract the dynamic parameter.
    const { quizId } = await Promise.resolve(params);
    const quizIdNumber = Number(quizId);

    return (
        <QuizLayout
            sidebar={<QuizSidebar />}
            content={<QuizPageClient quizId={quizIdNumber} />}
        />
    );
}
