// src/server/api/routers/quiz.ts
import { z } from "zod";
import {
    createTRPCRouter,
    publicProcedure,
    protectedProcedure,
} from "~/server/api/trpc";
import { type Quiz } from "~/types/Quiz";
import { type ChatMessage } from "~/types/ChatMessage";

export const quizRouter = createTRPCRouter({
    // Use an "upsert" so that if a quiz with the same ID exists,
    // we update it (specifically, we set the userId) rather than creating a duplicate.
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
                messages: [], // (Messages can be added/fetched separately.)
            };
        }),

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
                    sessionId: m.sessionId,
                    role: m.role as "user" | "model",
                    content: m.content,
                    createdAt: m.createdAt,
                })),
            };
        }),

    getAllQuizzesByUser: protectedProcedure.query(async ({ ctx }): Promise<Quiz[] | null> => {
        const quizzes = await ctx.db.quiz.findMany({
            where: { userId: ctx.session.user.id },
            include: { messages: true },
        });

        return quizzes.map((quiz) => ({
            id: quiz.id,
            title: quiz.title ?? undefined,
            userId: quiz.userId ?? undefined,
            createdAt: quiz.createdAt,
            updatedAt: quiz.updatedAt,
            messages: quiz.messages.map((m): ChatMessage => ({
                id: m.id,
                sessionId: m.sessionId,
                role: m.role as "user" | "model",
                content: m.content,
                createdAt: m.createdAt,
            })),
        }));
    }),

    addChatMessage: publicProcedure
        .input(
            z.object({
                quizId: z.string(),
                role: z.enum(["user", "model"]),
                content: z.string(),
            })
        )
        .mutation(async ({ ctx, input }): Promise<ChatMessage> => {
            const newMessage = await ctx.db.chatMessage.create({
                data: {
                    sessionId: input.quizId,
                    role: input.role,
                    content: input.content,
                    createdAt: new Date(),
                },
            });
            return {
                id: newMessage.id,
                sessionId: newMessage.sessionId,
                role: newMessage.role as "user" | "model",
                content: newMessage.content,
                createdAt: newMessage.createdAt,
            };
        }),
});
