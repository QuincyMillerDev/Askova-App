// src/app/auth/success/page.tsx
"use client";

// import { useEffect } from "react";
// import { useSearchParams, useRouter } from "next/navigation";
// import { api } from "~/trpc/react";
// import { db } from "~/db/dexie";

// TODO: Update to use the Sync Service
export default function AuthSuccessPage() {
    // // Read callbackUrl from query parameters (defaults to /quiz)
    // const searchParams = useSearchParams();
    // const callbackUrl = searchParams.get("callbackUrl") ?? "/quiz";
    //
    // const router = useRouter();
    //
    // // Fetch user data using our protected tRPC procedure.
    // const { data: userData, isLoading } = api.user.getUserData.useQuery(undefined, {
    //     enabled: true,
    // });
    //
    // useEffect(() => {
    //     async function syncAndRedirect() {
    //         if (userData) {
    //             // Insert the user data into Dexie.
    //             try {
    //                 await db.user.put(userData);
    //                 if (userData.quizzes && userData.quizzes.length > 0) {
    //                     // Bulk insert the quizzes.
    //                     await db.quizzes.bulkPut(userData.quizzes);
    //                     // For each quiz, bulk insert its chat messages.
    //                     for (const quiz of userData.quizzes) {
    //                         if (quiz.messages && quiz.messages.length > 0) {
    //                             await db.chatMessages.bulkPut(quiz.messages);
    //                         }
    //                     }
    //                 }
    //             } catch (error) {
    //                 console.error("Error syncing data to Dexie:", error);
    //             }
    //             // After syncing, navigate back to the user’s previous page.
    //             router.push(callbackUrl);
    //         }
    //     }
    //
    //     if (!isLoading && userData) {
    //         void syncAndRedirect();
    //     }
    // }, [isLoading, userData, router, callbackUrl]);

    return (
        <div className="flex h-screen items-center justify-center p-4">
            <p>Synchronizing your data, please wait...</p>
        </div>
    );
}
