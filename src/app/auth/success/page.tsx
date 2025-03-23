// src/app/auth/success/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSync } from "~/hooks/useSync";
import { useSession } from "next-auth/react";

export default function AuthSuccessPage() {
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/quiz";
    const router = useRouter();
    const { syncUserData } = useSync();
    const { status } = useSession();

    useEffect(() => {
        async function handleAuthSuccess() {
            try {
                // If not authenticated, wait briefly and check again
                if (status !== "authenticated") {
                    console.log("Waiting for authentication to complete...");
                    
                    // Redirect after timeout if still not authenticated
                    if (status === "unauthenticated") {
                        setError("Authentication failed. Please try logging in again.");
                        return;
                    }
                    
                    // If loading, we'll retry on the next render when status changes
                    if (status === "loading") {
                        return;
                    }
                }

                await syncUserData();
                // After syncing, navigate back to the user's previous page
                router.push(callbackUrl);
            } catch (error) {
                console.error("Error during auth success sync:", error);
                setError("Failed to sync your data. Please try again.");
            }
        }

        void handleAuthSuccess();
    }, [router, callbackUrl, syncUserData, status]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <p className="text-lg text-red-500">{error}</p>
                    <button 
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                        onClick={() => router.push("/auth")}
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center p-4">
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-lg text-muted-foreground">Synchronizing your data, please wait...</p>
            </div>
        </div>
    );
}
