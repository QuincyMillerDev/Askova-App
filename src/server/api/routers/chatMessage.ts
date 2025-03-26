// src/server/api/routers/chatMessage.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server"; // Import TRPCError

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

// Other existing schemas (add, update, delete, getById, getByQuiz) remain the same
const addChatMessageSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
});
const updateChatMessageSchema = z.object({
    id: z.string(),
    content: z.string().optional(),
});
const deleteChatMessageSchema = z.object({
    id: z.string(),
});
const getChatMessageByIdSchema = z.object({
    id: z.string(),
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

    // --- Other procedures (add, getById, getByQuiz, update, delete) ---
    // These might become less relevant if 'upsert' handles most client->server sync.
    // 'add' could potentially be replaced by 'upsert'.
    // 'update' might still be useful for specific partial updates initiated from UI.

    // TODO: Consider replacing legacy procedures with upsert
    // CREATE (Legacy? Consider replacing with upsert call from client)
    add: protectedProcedure
        .input(addChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            // ... existing implementation ...
            // Add the same authorization check as in upsert before creating
            const userId = ctx.session.user.id;
            const quiz = await ctx.db.quiz.findUnique({
                where: { id_userId: { id: input.quizId, userId: userId } },
                select: { userId: true },
            });
            if (!quiz) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Quiz not found or user does not have access.",
                });
            }
            return await ctx.db.chatMessage.create({
                data: {
                    id: input.id,
                    quizId: input.quizId,
                    userId: userId,
                    role: input.role,
                    content: input.content,
                    createdAt: input.createdAt,
                },
            });
        }),

    // READ: Retrieve a single chat message by its ID
    getById: protectedProcedure
        .input(getChatMessageByIdSchema)
        .output(mappedChatMessageOutputSchema.nullable()) // Use updated output schema
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const msg = await ctx.db.chatMessage.findUnique({
                where: { id: input.id },
            });
            // Authorization check: Ensure the message belongs to the user
            if (!msg || msg.userId !== userId) return null;

            return {
                id: msg.id,
                quizId: msg.quizId,
                role: msg.role as "user" | "model",
                content: msg.content,
                createdAt: msg.createdAt,
                status: "done", // Add status
            };
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

    // UPDATE: Update properties of a chat message
    update: protectedProcedure
        .input(updateChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            // Authorization check: Find the message first to check ownership
            const message = await ctx.db.chatMessage.findUnique({
                where: { id: input.id },
                select: { userId: true },
            });
            if (!message || message.userId !== userId) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Message not found or user does not have access.",
                });
            }

            const dataToUpdate: { content?: string } = {};
            if (input.content !== undefined) {
                dataToUpdate.content = input.content;
            }
            // Only update if there's something to update
            if (Object.keys(dataToUpdate).length === 0) {
                return message; // Or return the existing message data
            }
            return await ctx.db.chatMessage.update({
                where: { id: input.id /* userId: userId */ }, // userId check redundant
                data: dataToUpdate,
            });
        }),

    // DELETE: Delete a chat message by its ID
    delete: protectedProcedure
        .input(deleteChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            // Authorization check
            const message = await ctx.db.chatMessage.findUnique({
                where: { id: input.id },
                select: { userId: true },
            });
            if (!message || message.userId !== userId) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Message not found or user does not have access.",
                });
            }
            await ctx.db.chatMessage.delete({
                where: { id: input.id /* userId: userId */ }, // userId check redundant
            });
            return { success: true };
        }),
});
