import { db } from "~/db/dexie";
import { api } from "~/trpc/react";
import type { Quiz } from "~/types/Quiz";
import type { ChatMessage } from "~/types/ChatMessage";
import { useSession } from "next-auth/react";

export function useSync() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";
    
    const createQuizMutation = api.quiz.create.useMutation();
    const addChatMessageMutation = api.quiz.addChatMessage.useMutation();
    const getUserDataQuery = api.user.getUserData.useQuery(undefined, {
        enabled: isAuthenticated, // Only run the query if the user is authenticated
    });

    const createQuizSync = async (quiz: Quiz): Promise<void> => {
        try {
            // Write the quiz session locally
            await db.quizzes.put(quiz);
            console.log("Quiz saved locally:", quiz.id);

            // If the quiz is associated with an authenticated user, sync to the server.
            if (quiz.userId && isAuthenticated) {
                await createQuizMutation.mutateAsync({
                    id: quiz.id,
                    title: quiz.title,
                });
                console.log("Quiz synced to server:", quiz.id);
            } else {
                console.warn(
                    "Quiz created without an authenticated user. Server sync skipped."
                );
            }
        } catch (error) {
            console.error("Error syncing quiz:", error);
            throw error;
        }
    };

    const addChatMessageSync = async (
        message: ChatMessage,
    ): Promise<void> => {
        try {
            // Save the chat message locally in Dexie
            await db.chatMessages.add(message);
            console.log("Chat message saved locally:", message.id);

            // If authenticated, sync the message to the server.
            if (isAuthenticated) {
                await addChatMessageMutation.mutateAsync({
                    quizId: message.quizId,
                    role: message.role,
                    content: message.content,
                });
                console.log("Chat message synced to server for quiz:", message.quizId);
            } else {
                console.warn(
                    "User not authenticated; chat message not synced to the server."
                );
            }
        } catch (error) {
            console.error("Error syncing chat message:", error);
            throw error;
        }
    };

    const syncUserData = async (): Promise<void> => {
        try {
            if (!isAuthenticated) {
                console.warn("User is not authenticated. Cannot sync user data.");
                return;
            }
            
            const userData = await getUserDataQuery.refetch();
            
            if (userData.data) {
                // Insert the user data into Dexie
                await db.user.put(userData.data);
                
                // If there are quizzes, sync them
                if (userData.data.quizzes?.length) {
                    // Bulk insert the quizzes
                    await db.quizzes.bulkPut(userData.data.quizzes);
                    
                    // For each quiz, bulk insert its chat messages
                    for (const quiz of userData.data.quizzes) {
                        if (quiz.messages?.length) {
                            await db.chatMessages.bulkPut(quiz.messages);
                        }
                    }
                }
                
                console.log("User data successfully synchronized to Dexie");
            }
        } catch (error) {
            console.error("Error syncing user data:", error);
            throw error;
        }
    };
    
    // Return authentication status along with the sync functions
    return {
        createQuizSync,
        addChatMessageSync,
        syncUserData,
        isAuthenticated,
    };
} 