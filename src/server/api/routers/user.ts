import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {type ChatMessage} from "~/types/ChatMessage";
import {type Quiz} from "~/types/Quiz";

// Define Zod schemas for output validation
const chatMessageSchema = z.object({
    id: z.number(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
});

const quizSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    userId: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    messages: z.array(chatMessageSchema),
});

const userSchema = z.object({
    id: z.string(),
    name: z.string(),
    quizzes: z.array(quizSchema),
});

export const userRouter = createTRPCRouter({
    getUser: protectedProcedure
        .output(userSchema)
        .query(async ({ ctx }): Promise<z.infer<typeof userSchema>> => {
            // Get the user's quizzes with their messages
            const quizzes = await ctx.db.quiz.findMany({
                where: { userId: ctx.session.user.id },
                include: { messages: true },
            });

            // Transform the data to match our shared types
            return {
                id: ctx.session.user.id,
                name: ctx.session.user.name ?? "",
                quizzes: quizzes.map((quiz): Quiz => ({
                    id: quiz.id,
                    title: quiz.title ?? undefined,
                    userId: quiz.userId ?? undefined,
                    createdAt: quiz.createdAt,
                    updatedAt: quiz.updatedAt,
                    messages: quiz.messages.map((m): ChatMessage => ({
                        id: m.id,
                        quizId: m.quizId,
                        role: m.role as "user" | "model",
                        content: m.content,
                        createdAt: m.createdAt,
                    })),
                })),
            };
        }),

    deleteUser: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.$transaction(async (tx) => {
            const userId = ctx.session.user.id;

            // 1. Retrieve IDs of all quizzes created by this user.
            const userQuizzes = await tx.quiz.findMany({
                where: { userId },
                select: { id: true },
            });

            // 2. Delete all chat messages for these quizzes.
            if (userQuizzes.length > 0) {
                await tx.chatMessage.deleteMany({
                    where: {
                        quizId: { in: userQuizzes.map((quiz) => quiz.id) },
                    },
                });
            }

            // 3. Delete all quizzes for this user.
            await tx.quiz.deleteMany({
                where: { userId },
            });

            // 4. Finally, delete the user record.
            await tx.user.delete({
                where: { id: userId },
            });
        });
        return { success: true };
    }),
});