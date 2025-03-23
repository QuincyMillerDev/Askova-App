// src/server/api/routers/user.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Zod schemas for the data returned by this procedure.
 * These schemas mirror the shared types from /types.
 */
const chatMessageSchema = z.object({
    id: z.number(),
    sessionId: z.string(),
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

const userOutputSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    image: z.string().optional(),
    quizzes: z.array(quizSchema),
});

export const userRouter = createTRPCRouter({
    getUserData: protectedProcedure
        .output(userOutputSchema)
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;
            const user = await ctx.db.user.findUnique({
                where: { id: userId },
                include: {
                    // Include quizzes and their associated chat messages.
                    quizzes: {
                        include: {
                            messages: true,
                        },
                    },
                },
            });

            if (!user) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found.",
                });
            }

            // Map and transform the returned user data to match our Zod schema.
            return {
                id: user.id,
                name: user.name ?? undefined,
                email: user.email ?? undefined,
                image: user.image ?? undefined,
                quizzes: user.quizzes.map((q) => ({
                    id: q.id,
                    title: q.title ?? undefined,
                    userId: q.userId ?? undefined,
                    createdAt: q.createdAt,
                    updatedAt: q.updatedAt,
                    messages: q.messages.map((m) => ({
                        id: m.id,
                        sessionId: m.sessionId,
                        role: m.role as "user" | "model",
                        content: m.content,
                        createdAt: m.createdAt,
                    })),
                })),
            };
        }),
});
