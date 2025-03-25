// src/server/api/routers/chatMessage.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {ChatMessage} from "~/db/dexie";

// Schema for adding a chat message.
const addChatMessageSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
});

// Schema for updating a chat message (currently only allowing updating the content).
const updateChatMessageSchema = z.object({
    id: z.string(),
    content: z.string().optional(),
});

// Schema for deleting a chat message.
const deleteChatMessageSchema = z.object({
    id: z.string(),
});

// Schema for retrieving a single chat message by its ID.
const getChatMessageByIdSchema = z.object({
    id: z.string(),
});

// Schema for retrieving all chat messages for a given quiz.
const getChatMessagesByQuizSchema = z.object({
    quizId: z.string(),
});

// Output schema for mapped chat message (including the extra status property).
const mappedChatMessageOutputSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
    status: z.literal("done"),
});


export const chatMessageRouter = createTRPCRouter({
    // CREATE: Add a new chat message to a quiz session.
    add: protectedProcedure
        .input(addChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

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

    // READ: Retrieve a single chat message by its ID with mapping logic.
    getById: protectedProcedure
        .input(getChatMessageByIdSchema)
        .output(mappedChatMessageOutputSchema.nullable())
        .query(async ({ ctx, input }) => {
            const msg = await ctx.db.chatMessage.findUnique({
                where: { id: input.id },
            });
            if (!msg) return null;
            return {
                id: msg.id,
                quizId: msg.quizId,
                role: msg.role as "user" | "model",
                content: msg.content,
                createdAt: msg.createdAt,
                status: "done",
            };
        }),

    // READ: Retrieve all chat messages for a specific quiz session, ordered by creation time.
    getByQuiz: protectedProcedure
        .input(getChatMessagesByQuizSchema)
        .output(z.array(mappedChatMessageOutputSchema))
        .query(async ({ ctx, input }) => {
            const messages = await ctx.db.chatMessage.findMany({
                where: { quizId: input.quizId },
                orderBy: { createdAt: "asc" },
            });
            return messages.map((msg) => ({
                id: msg.id,
                quizId: msg.quizId,
                role: msg.role as "user" | "model",
                content: msg.content,
                createdAt: msg.createdAt,
                status: "done",
            }));
        }),

    // READ: Retrieve all chat messages for the current user, with mapping logic.
    getUserChatMessages: protectedProcedure
        .output(z.array(mappedChatMessageOutputSchema))
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;
            const messages = await ctx.db.chatMessage.findMany({
                where: { userId },
                orderBy: { createdAt: "asc" },
            });
            return messages.map((msg) => ({
                id: msg.id,
                quizId: msg.quizId,
                role: msg.role as "user" | "model",
                content: msg.content,
                createdAt: msg.createdAt,
                status: "done",
            }));
        }),

    // UPDATE: Update properties of a chat message (e.g., its content).
    update: protectedProcedure
        .input(updateChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            const dataToUpdate: { content?: string } = {};
            if (input.content !== undefined) {
                dataToUpdate.content = input.content;
            }
            return await ctx.db.chatMessage.update({
                where: { id: input.id },
                data: dataToUpdate,
            });
        }),

    // DELETE: Delete a chat message by its ID.
    delete: protectedProcedure
        .input(deleteChatMessageSchema)
        .mutation(async ({ ctx, input }) => {
            await ctx.db.chatMessage.delete({
                where: { id: input.id },
            });
            return { success: true };
        }),
});
