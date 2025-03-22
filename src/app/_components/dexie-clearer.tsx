"use client";

import {useClearDexieOnLogout} from "~/app/hooks/useClearDexieOnLogout";

export function DexieClearer() {
    // This hook will clear Dexie when the session is missing.
    useClearDexieOnLogout();
    return null;
}