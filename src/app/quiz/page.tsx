import { QuizLayout } from "../_components/quiz-layout";
import { QuizInterface } from "../_components/quiz-interface";
import { QuizSidebar } from "../_components/quiz-sidebar";
import { HydrateClient } from "~/trpc/server";

export default function Home() {
  return (
    <HydrateClient>
      <main>
        <QuizLayout
          sidebar={<QuizSidebar />}
          content={<QuizInterface />}
        />
      </main>
    </HydrateClient>
  );
}

