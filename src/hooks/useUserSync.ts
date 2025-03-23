// src/hooks/useUserSync.ts
import { db } from "~/db/dexie";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";

export function useUserSync() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    // Note: the query is only enabled when authenticated.
    const getUserDataQuery = api.user.getUserData.useQuery(undefined, {
        enabled: isAuthenticated
    });

    const syncUserData = async (): Promise<void> => {
        try {
            if (!isAuthenticated) {
                console.warn("User is not authenticated. Cannot sync user data.");
                return;
            }

            // Refetch server user data.
            const userData = await getUserDataQuery.refetch();

            if (userData.data) {
                // Insert the user data locally in Dexie.
                await db.user.put(userData.data);

                // Bulk insert quizzes and their messages.
                if (userData.data.quizzes?.length) {
                    await db.quizzes.bulkPut(userData.data.quizzes);
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

    return { syncUserData, isAuthenticated };
}
