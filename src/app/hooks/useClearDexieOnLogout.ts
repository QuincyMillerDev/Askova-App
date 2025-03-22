// src/app/hooks/useClearDexieOnLogout.ts
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { db } from "~/db/dexie";

export function useClearDexieOnLogout() {
    const { data: session } = useSession();

    useEffect(() => {
        // When there is no session, clear all persisted data in Dexie.
        if (!session?.user) {
            const clearDatabase = async () => {
                try {
                    // Option 1: Clear all tables
                    await db.quizzes.clear();
                    await db.chatMessages.clear();
                    console.info("Dexie database cleared on logout");
                } catch (error) {
                    console.error("Error clearing Dexie database on logout:", error);
                }
            };

            void clearDatabase();
        }
    }, [session]);
}
