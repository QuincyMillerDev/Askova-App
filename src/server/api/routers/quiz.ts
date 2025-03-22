// src/server/api/routers/quiz.ts

import { z } from "zod";
import {
    createTRPCRouter,
    publicProcedure,
    protectedProcedure
} from "~/server/api/trpc";
import {type Quiz} from "~/types/Quiz";
import {type ChatMessage} from "~/types/ChatMessage";

export const quizRouter = createTRPCRouter({
    // A protected procedure ensures that a logged-in user is creating a persistent quiz.
    create: protectedProcedure
        .input(
            // Use the shared type for input if needed (here just an optional title)
            z.object({
                id: z.string(),
                title: z.string().optional()
            })
        )
        .mutation(async ({ ctx, input }): Promise<Quiz> => {
            // At this point, ctx.session.user is guaranteed to exist.
            const userId = ctx.session.user.id;
            const now = new Date();
            // Use Prisma to create the quiz.
            const createdQuiz = await ctx.db.quiz.create({
                data: {
                    id: input.id,
                    title: input.title,
                    userId,
                    createdAt: now,
                    updatedAt: now,
                },
            });
            // Return the result. Make sure the type matches Quiz.
            return {
                id: createdQuiz.id,
                title: createdQuiz.title ?? undefined,
                userId: createdQuiz.userId ?? undefined,
                createdAt: createdQuiz.createdAt,
                updatedAt: createdQuiz.updatedAt,
                messages: [], // For now; you can fetch related messages separately.
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

    // Define additional procedures (like adding a chat message)
    addChatMessage: publicProcedure
        .input(
            z.object({
                quizId: z.string(),
                role: z.enum(["user", "model"]),
                content: z.string(),
            })
        )
        .mutation(async ({ ctx, input }): Promise<ChatMessage> => {
            // Create a new chat message using Prisma and return the shared ChatMessage type.
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