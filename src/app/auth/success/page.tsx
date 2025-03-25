"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserSync } from "~/app/hooks/useUserSync";

export default function AuthSuccessPage() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/quiz";
    const router = useRouter();
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    // Our new hook to synchronize data
    const { syncUserData } = useUserSync();

    useEffect(() => {
        async function handleAuthSuccess() {
            if (!isAuthenticated) return;
            try {
                // Sync outstanding local data (if any) upward and then refresh the
                // local Dexie store with remote data.
                await syncUserData();
                router.push(callbackUrl);
            } catch (error) {
                console.error("Error during auth sync:", error);
                router.push("/auth/error");
            }
        }
        void handleAuthSuccess();
    }, [isAuthenticated, router, callbackUrl, syncUserData]);

    return (
        <div className="flex h-screen items-center justify-center p-4">
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-lg text-muted-foreground">
                    Synchronizing your data, please wait...
                </p>
            </div>
        </div>
    );
}
