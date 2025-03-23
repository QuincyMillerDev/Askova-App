// src/server/api/routers/chatMessage.ts
import { z } from "zod";
import {
    createTRPCRouter,
    publicProcedure,
    protectedProcedure,
} from "~/server/api/trpc";
import type { ChatMessage } from "~/types/ChatMessage";

export const chatMessageRouter = createTRPCRouter({
    // Create a new chat message for a quiz session
    add: publicProcedure
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
                    quizId: input.quizId,
                    role: input.role,
                    content: input.content,
                    createdAt: new Date(),
                },
            });
            return {
                id: newMessage.id,
                quizId: newMessage.quizId,
                role: newMessage.role as "user" | "model",
                content: newMessage.content,
                createdAt: newMessage.createdAt,
            };
        }),

    // Update an existing chat message (e.g. in case of an edit)
    update: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                content: z.string(),
            })
        )
        .mutation(async ({ ctx, input }): Promise<ChatMessage> => {
            const updatedMessage = await ctx.db.chatMessage.update({
                where: { id: input.id },
                data: { content: input.content },
            });
            return {
                id: updatedMessage.id,
                quizId: updatedMessage.quizId,
                role: updatedMessage.role as "user" | "model",
                content: updatedMessage.content,
                createdAt: updatedMessage.createdAt,
            };
        }),

    // Delete a chat message by its ID
    delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.chatMessage.delete({
                where: { id: input.id },
            });
            return { success: true };
        }),
});
