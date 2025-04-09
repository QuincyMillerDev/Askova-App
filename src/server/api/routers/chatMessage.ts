// src/server/api/routers/chatMessage.ts
import { z } from "zod";
import {createTRPCRouter, protectedProcedure} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// --- Schemas ---

// Input schema for upsert (matches DexieChatMessage shape, excluding 'status')
const upsertChatMessageSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
});

// Output schema for mapped chat message (matches DexieChatMessage shape)
const mappedChatMessageOutputSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
    status: z.literal("done"), // Add status field required by Dexie type
});

const getChatMessagesByQuizSchema = z.object({
    quizId: z.string(),
});

// --- Router ---

export const chatMessageRouter = createTRPCRouter({
    // UPSERT: Create or update a chat message. Used for syncing from client.
    upsert: protectedProcedure
        .input(upsertChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            // Authorization Check: Ensure the user owns the quiz this message belongs to.
            const quiz = await ctx.db.quiz.findUnique({
                where: {
                    // Use the compound unique constraint if added
                    id_userId: {
                        id: input.quizId,
                        userId: userId,
                    },
                    // Fallback if constraint wasn't added (less efficient)
                    // id: input.quizId
                },
                select: { userId: true },
            });

            // If using fallback, add: if (quiz && quiz.userId !== userId) quiz = null;

            if (!quiz) {
                // Important: Check if the quiz exists *and* belongs to the user
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Quiz not found or user does not have access.",
                });
            }

            // Use Prisma's upsert operation
            return await ctx.db.chatMessage.upsert({
                where: {
                    id: input.id, // Assuming 'id' is the primary key for ChatMessage
                },
                create: {
                    id: input.id,
                    quizId: input.quizId,
                    userId: userId, // Assign to the current user
                    role: input.role,
                    content: input.content,
                    createdAt: input.createdAt,
                },
                update: {
                    // Only update fields that might change after initial sync
                    content: input.content,
                    // role: input.role, // Only if role can change
                    // Avoid updating createdAt, userId, quizId
                },
            });
        }),

    // READ: Retrieve all chat messages for the current user. Used for bulk sync down.
    // Ensure this returns data compatible with the Dexie ChatMessage type.
    getUserChatMessages: protectedProcedure
        .output(z.array(mappedChatMessageOutputSchema)) // Use the updated output schema
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;
            const messages = await ctx.db.chatMessage.findMany({
                where: { userId },
                orderBy: { createdAt: "asc" },
                // No pagination (take/skip) to get all messages
            });
            // Map Prisma result to the Dexie-compatible output schema
            return messages.map((msg) => ({
                id: msg.id,
                quizId: msg.quizId,
                role: msg.role as "user" | "model", // Assuming role is stored as string
                content: msg.content,
                createdAt: msg.createdAt,
                status: "done", // Add the default status for Dexie
            }));
        }),

    // READ: Retrieve all chat messages for a specific quiz session
    getByQuiz: protectedProcedure
        .input(getChatMessagesByQuizSchema)
        .output(z.array(mappedChatMessageOutputSchema)) // Use updated output schema
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            // Authorization check: Ensure user owns the quiz
            const quiz = await ctx.db.quiz.findUnique({
                where: { id_userId: { id: input.quizId, userId: userId } },
                select: { id: true },
            });
            if (!quiz) {
                // Return empty array or throw error if quiz not accessible
                return [];
                // throw new TRPCError({ code: "FORBIDDEN" });
            }

            const messages = await ctx.db.chatMessage.findMany({
                where: { quizId: input.quizId /* userId: userId */ }, // userId check redundant due to quiz check
                orderBy: { createdAt: "asc" },
            });
            return messages.map((msg) => ({
                id: msg.id,
                quizId: msg.quizId,
                role: msg.role as "user" | "model",
                content: msg.content,
                createdAt: msg.createdAt,
                status: "done", // Add status
            }));
        }),
});
