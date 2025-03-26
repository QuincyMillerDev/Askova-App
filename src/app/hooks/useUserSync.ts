// src/app/hooks/useUserSync.ts
import { useCallback, useState } from "react";
import syncService from "~/services/syncService";

export function useUserSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<Error | null>(null);
    const [lastSyncResult, setLastSyncResult] = useState<{
        uploadedQuizzes: number;
        uploadedMessages: number;
        downloadedQuizzes: number;
        downloadedMessages: number;
    } | null>(null);

    const syncUserData = useCallback(async () => {
        setIsSyncing(true);
        setSyncError(null);
        setLastSyncResult(null);
        try {
            const result = await syncService.performBulkSync();
            setLastSyncResult(result);
            console.log("[HOOK] Bulk sync successful:", result);
        } catch (error) {
            console.error("[HOOK ERROR] Bulk sync failed:", error);
            setSyncError(error instanceof Error ? error : new Error("Sync failed"));
        } finally {
            setIsSyncing(false);
        }
    }, []);

    return { syncUserData, isSyncing, syncError, lastSyncResult };
}