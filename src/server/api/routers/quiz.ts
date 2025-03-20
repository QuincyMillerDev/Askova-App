// src/server/api/routers/quiz.ts

import { z } from "zod";
import {
    createTRPCRouter,
    publicProcedure
} from "~/server/api/trpc";

export const quizRouter = createTRPCRouter({
    create: publicProcedure
        .input(z.object({title: z.string().optional()}))
        .mutation(async ({ctx, input}) => {
            // If a user is authenticated, user their id
            const userId = ctx.session?.user?.id;
            return ctx.db.quiz.create({
                data: {
                    title: input.title,
                    userId: userId,
                }
            })
        }),

    getAll: publicProcedure.query(async ({ctx}) => {
        const userId = ctx.session?.user?.id;
        return ctx.db.quiz.findMany({
            where: {userId: userId},
            orderBy: {createdAt: "desc"},
        })
    }),

    getById: publicProcedure
        .input(z.object({quizId: z.number()}))
        .query(async ({ctx, input}) => {
            return ctx.db.quiz.findUnique({
                where: {id: input.quizId},
                include: {messages: true},
            });
        }),

    addChatMessage: publicProcedure
        .input(
            z.object({
                quizId: z.number(),
                role: z.enum(["user", "model"]),
                content: z.string(),
            })
        )
        .mutation(async ({ctx, input}) => {
            return ctx.db.chatMessage.create({
                data: {
                    sessionId: input.quizId,
                    role: input.role,
                    content: input.content,
                },
            });
        }),
})