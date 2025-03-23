// src/app/auth/success/page.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {useUserSync} from "~/hooks/useUserSync";
import {db} from "~/db/dexie";

export default function AuthSuccessPage() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/quiz";
    const router = useRouter();
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    // (Optional) Sync server user data back into the client.
    const { syncUserData } = useUserSync();

    useEffect(() => {
        async function handleAuthSuccess() {
            if (!isAuthenticated) return;
            try {
                await db.clearAllData();
                await syncUserData();
                router.push(callbackUrl);
            } catch (error) {
                console.error("Error during auth success sync:", error);
                // Redirect to your auth error page with an appropriate query parameter
                router.push("/auth/error?error=sync");
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
