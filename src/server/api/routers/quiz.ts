// src/server/api/routers/quiz.ts
import { z } from "zod";
import {
    createTRPCRouter,
    publicProcedure,
    protectedProcedure,
} from "~/server/api/trpc";
import type { Quiz } from "~/types/Quiz";

export const quizRouter = createTRPCRouter({
    // Create or update a quiz (upsert)
    create: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                title: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }): Promise<Quiz> => {
            const userId = ctx.session.user.id;
            const now = new Date();

            const persistedQuiz = await ctx.db.quiz.upsert({
                where: { id: input.id },
                create: {
                    id: input.id,
                    title: input.title,
                    userId,
                    createdAt: now,
                    updatedAt: now,
                },
                update: {
                    userId,
                },
            });

            // Return the quiz in the shape of our shared Quiz type.
            return {
                id: persistedQuiz.id,
                title: persistedQuiz.title ?? undefined,
                userId: persistedQuiz.userId ?? undefined,
                createdAt: persistedQuiz.createdAt,
                updatedAt: persistedQuiz.updatedAt,
                messages: [], // Chat message handling is now in its own router.
            };
        }),

    // Read – Get a quiz by its ID (including any associated chat messages)
    getById: publicProcedure
        .input(z.object({ quizId: z.string() }))
        .query(async ({ ctx, input }): Promise<Quiz | null> => {
            const quiz = await ctx.db.quiz.findUnique({
                where: { id: input.quizId },
                include: { messages: true },
            });

            if (!quiz) return null;
            return {
                id: quiz.id,
                title: quiz.title ?? undefined,
                userId: quiz.userId ?? undefined,
                createdAt: quiz.createdAt,
                updatedAt: quiz.updatedAt,
                messages: quiz.messages.map((m) => ({
                    id: m.id,
                    quizId: m.quizId,
                    role: m.role as "user" | "model",
                    content: m.content,
                    createdAt: m.createdAt,
                })),
            };
        }),
});
