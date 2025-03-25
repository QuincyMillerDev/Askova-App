// src/server/api/routers/quiz.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { type Quiz } from "~/db/dexie";

// Schema for creating a quiz
const createQuizSchema = z.object({
    id: z.string(),
    title: z.string(),
    userId: z.string().optional(), // May be provided externally, but we use session userId
    createdAt: z.date(),
    updatedAt: z.date(),
    lastMessageAt: z.date(),
});

// Schema for updating a quiz (allow updating some fields)
const updateQuizSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    lastMessageAt: z.date().optional(),
});

// Schema for deleting a quiz
const deleteQuizSchema = z.object({
    quizId: z.string(),
});

// Zod output schema for a mapped ChatMessage.
// Note that the status field is fixed to "done".
const mappedChatMessageOutputSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
    status: z.literal("done"),
});

// Zod output schema for a mapped Quiz.
const mappedQuizOutputSchema = z.object({
    id: z.string(),
    title: z.string(),
    userId: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastMessageAt: z.date(),
    status: z.literal("done"),
    messages: z.array(mappedChatMessageOutputSchema),
});

export const quizRouter = createTRPCRouter({
    // CREATE: Create a new quiz.
    create: protectedProcedure
        .input(createQuizSchema)

        .mutation(async ({ ctx, input }) => {
            // Override userId with the current session's user id.
            const userId = ctx.session.user.id;

            return await ctx.db.quiz.create({
                data: {
                    id: input.id,
                    title: input.title,
                    userId: userId,
                    createdAt: input.createdAt,
                    updatedAt: input.updatedAt,
                    lastMessageAt: input.lastMessageAt,
                },
            });
        }),

    // READ: Get a single quiz by its ID.
    getById: protectedProcedure
        .input(z.object({ quizId: z.string() }))
        .output(mappedQuizOutputSchema.nullable())
        .query(async ({ ctx, input }) => {
            const quiz = await ctx.db.quiz.findUnique({
                where: { id: input.quizId },
                include: { messages: true },
            });
            if (!quiz) return null;
            return {
                id: quiz.id,
                title: quiz.title,
                createdAt: quiz.createdAt,
                updatedAt: quiz.updatedAt,
                lastMessageAt: quiz.lastMessageAt,
                status: "done",
                messages: quiz.messages.map((m) => ({
                    id: m.id,
                    quizId: m.quizId,
                    role: m.role as "user" | "model",
                    content: m.content,
                    createdAt: m.createdAt,
                    status: "done",
                })),
            };
        }),

    // READ: Get quizzes only for the authenticated user.
    getByUser: protectedProcedure
        .output(z.array(mappedQuizOutputSchema))
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;
            const quizzes = await ctx.db.quiz.findMany({
                where: { userId },
                include: { messages: true },
                orderBy: { createdAt: "desc" },
            });
            return quizzes.map((quiz) => ({
                id: quiz.id,
                title: quiz.title,
                userId: quiz.userId ?? undefined,
                createdAt: quiz.createdAt,
                updatedAt: quiz.updatedAt,
                lastMessageAt: quiz.lastMessageAt,
                status: "done",
                messages: quiz.messages.map((m) => ({
                    id: m.id,
                    quizId: m.quizId,
                    role: m.role as "user" | "model",
                    content: m.content,
                    createdAt: m.createdAt,
                    status: "done",
                })),
            }));
        }),

    // UPDATE: Update properties of a quiz.
    update: protectedProcedure
        .input(updateQuizSchema)
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.quiz.update({
                where: { id: input.id },
                data: {
                    // Only update provided fields (title and/or lastMessageAt).
                    ...(input.title && { title: input.title }),
                    ...(input.lastMessageAt && { lastMessageAt: input.lastMessageAt }),
                },
            });
        }),

    // DELETE: Delete a quiz by its ID.
    delete: protectedProcedure
        .input(deleteQuizSchema)
        .mutation(async ({ ctx, input }) => {
            await ctx.db.quiz.delete({
                where: { id: input.quizId },
            });
            return { success: true };
        }),
});
