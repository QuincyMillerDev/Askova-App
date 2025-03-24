"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
    const router = useRouter()

    useEffect(() => {
        router.push("/settings/account")
    }, [router])

    return (
        <div className="flex items-center justify-center h-full">
            <p>Redirecting to account settings...</p>
        </div>
    )
}

