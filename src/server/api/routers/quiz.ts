// src/server/api/routers/quiz.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server"; // Import TRPCError

// --- Schemas ---

// Input schema for upsert (matches DexieQuiz shape, excluding 'messages' and 'status')
const upsertQuizSchema = z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastMessageAt: z.date(),
});

// Zod output schema for a mapped ChatMessage (matches DexieChatMessage shape)
const mappedChatMessageOutputSchema = z.object({
    id: z.string(),
    quizId: z.string(),
    role: z.enum(["user", "model"]),
    content: z.string(),
    createdAt: z.date(),
    status: z.literal("done"), // Add status field required by Dexie type
});

// Zod output schema for a mapped Quiz (matches DexieQuiz shape)
// IMPORTANT: Exclude 'messages' here if they are synced separately via chatMessage router
// Including them can be very inefficient for bulk sync.
const mappedQuizOutputSchema = z.object({
    id: z.string(),
    title: z.string(),
    // userId: z.string(), // userId is implicit for getByUser, maybe not needed in output?
    createdAt: z.date(),
    updatedAt: z.date(),
    lastMessageAt: z.date(),
    status: z.literal("done"), // Add status field required by Dexie type
    // messages: z.array(mappedChatMessageOutputSchema), // <-- REMOVE or make optional for bulk sync efficiency
});

// Schema for fetching a single quiz WITH messages (for specific page load)
const mappedQuizWithMessagesOutputSchema = mappedQuizOutputSchema.extend({
    messages: z.array(mappedChatMessageOutputSchema),
});

// Other existing schemas (create, update, delete) remain the same
const createQuizSchema = z.object({
    id: z.string(),
    title: z.string(),
    // userId: z.string().optional(), // Not needed, always use session
    createdAt: z.date(),
    updatedAt: z.date(),
    lastMessageAt: z.date(),
});
const updateQuizSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    lastMessageAt: z.date().optional(),
});
const deleteQuizSchema = z.object({
    quizId: z.string(),
});

// --- Router ---

export const quizRouter = createTRPCRouter({
    // UPSERT: Create or update a quiz. Used for syncing from client.
    upsert: protectedProcedure
        .input(upsertQuizSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            // Use Prisma's upsert operation
            return await ctx.db.quiz.upsert({
                where: {
                    // Use the compound unique constraint for safety and efficiency
                    id_userId: {
                        id: input.id,
                        userId: userId,
                    },
                },
                create: {
                    // Data for creating a new quiz
                    id: input.id,
                    title: input.title,
                    userId: userId, // Assign to the current user
                    createdAt: input.createdAt,
                    updatedAt: input.updatedAt,
                    lastMessageAt: input.lastMessageAt,
                },
                update: {
                    // Data for updating an existing quiz
                    title: input.title,
                    updatedAt: input.updatedAt, // Keep updatedAt fresh
                    lastMessageAt: input.lastMessageAt,
                    // userId check is handled by the 'where' clause with the compound key
                },
            });
        }),

    // READ: Get quizzes metadata only for the authenticated user. Used for bulk sync down.
    // Excludes messages for efficiency.
    getByUser: protectedProcedure
        .output(z.array(mappedQuizOutputSchema)) // Use schema WITHOUT messages
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;
            const quizzes = await ctx.db.quiz.findMany({
                where: { userId },
                // include: { messages: false }, // Default is false, explicitly excluding is clearer
                orderBy: { createdAt: "desc" },
                // No pagination (take/skip)
            });
            // Map Prisma result to the Dexie-compatible output schema (without messages)
            return quizzes.map((quiz) => ({
                id: quiz.id,
                title: quiz.title,
                // userId: quiz.userId, // Optional: include if needed by Dexie logic
                createdAt: quiz.createdAt,
                updatedAt: quiz.updatedAt,
                lastMessageAt: quiz.lastMessageAt,
                status: "done", // Add default status
            }));
        }),

    // READ: Get a single quiz by its ID, INCLUDING messages. Used for loading a specific quiz page.
    getById: protectedProcedure
        .input(z.object({ quizId: z.string() }))
        .output(mappedQuizWithMessagesOutputSchema.nullable()) // Use schema WITH messages
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const quiz = await ctx.db.quiz.findUnique({
                where: {
                    // Use compound key for authorization
                    id_userId: {
                        id: input.quizId,
                        userId: userId,
                    },
                },
                include: {
                    messages: {
                        orderBy: { createdAt: "asc" }, // Order messages when fetching
                    },
                }, // Include messages here
            });

            if (!quiz) return null; // Handles not found or not authorized

            // Map to the output schema WITH messages
            return {
                id: quiz.id,
                title: quiz.title,
                createdAt: quiz.createdAt,
                updatedAt: quiz.updatedAt,
                lastMessageAt: quiz.lastMessageAt,
                status: "done", // Add status
                messages: quiz.messages.map((m) => ({
                    id: m.id,
                    quizId: m.quizId,
                    role: m.role as "user" | "model",
                    content: m.content,
                    createdAt: m.createdAt,
                    status: "done", // Add status
                })),
            };
        }),

    // --- Other procedures (create, update, delete) ---
    // Consider if 'create' and 'update' are still needed or if 'upsert' covers the use cases.
    // TODO: Consider replacing legacy procedures with upsert
    // CREATE (Legacy? Consider replacing with upsert call from client)
    create: protectedProcedure
        .input(createQuizSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            // Use create, but Prisma will throw error if id_userId constraint is violated
            try {
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
            } catch (error) {
                // Handle potential unique constraint violation if needed
                console.error("Quiz creation failed:", error);
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Quiz with this ID might already exist for the user.",
                });
            }
        }),

    // UPDATE: Update properties of a quiz.
    update: protectedProcedure
        .input(updateQuizSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            // Use update, relying on compound key for authorization in where clause
            try {
                return await ctx.db.quiz.update({
                    where: {
                        id_userId: {
                            id: input.id,
                            userId: userId,
                        },
                    },
                    data: {
                        // Only update provided fields
                        ...(input.title && { title: input.title }),
                        ...(input.lastMessageAt && { lastMessageAt: input.lastMessageAt }),
                        updatedAt: new Date(), // Ensure updatedAt is always updated
                    },
                });
            } catch (error) {
                // Handle case where quiz is not found for the user
                console.error("Quiz update failed:", error);
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Quiz not found or user does not have access.",
                });
            }
        }),

    // DELETE: Delete a quiz by its ID.
    delete: protectedProcedure
        .input(deleteQuizSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            // Use delete, relying on compound key for authorization
            try {
                await ctx.db.quiz.delete({
                    where: {
                        id_userId: {
                            id: input.quizId,
                            userId: userId,
                        },
                    },
                });
                return { success: true };
            } catch (error) {
                // Handle case where quiz is not found for the user
                console.error("Quiz deletion failed:", error);
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Quiz not found or user does not have access.",
                });
            }
        }),
});
