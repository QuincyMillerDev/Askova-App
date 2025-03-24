"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, User, CreditCard, Palette, History, Paperclip, LifeBuoy } from 'lucide-react'
import { ScrollArea } from "~/app/components/ui/scroll-area"
import { Button } from "~/app/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/app/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "~/app/components/ui/tabs"
import { Card } from "~/app/components/ui/card"
import { useSession, signOut } from "next-auth/react"
import { db } from "~/db/dexie"

interface SettingsLayoutProps {
    children: React.ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { data: session, status } = useSession()
    const [activeTab, setActiveTab] = useState("")

    useEffect(() => {
        // Redirect to auth page if user is not authenticated
        if (status === "unauthenticated") {
            router.push("/auth")
            return
        }

        // Extract the current tab from the pathname
        const path = pathname.split("/")
        if (path.length > 2) {
            setActiveTab(path[2] ?? "account") // Ensure a string is always passed
        } else {
            setActiveTab("account") // Default tab
        }
    }, [pathname, status, router])

    // Show loading state while checking authentication
    if (status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    // If unauthenticated, don't render anything (will redirect in useEffect)
    if (status === "unauthenticated") {
        return null
    }

    const tabs = [
        { id: "account", label: "Account", icon: <User className="h-4 w-4 mr-2" /> },
        { id: "subscription", label: "Subscription", icon: <CreditCard className="h-4 w-4 mr-2" /> },
        { id: "customization", label: "Customization", icon: <Palette className="h-4 w-4 mr-2" /> },
        { id: "history", label: "History & Sync", icon: <History className="h-4 w-4 mr-2" /> },
        { id: "attachments", label: "Attachments", icon: <Paperclip className="h-4 w-4 mr-2" /> },
        { id: "contact", label: "Contact Us", icon: <LifeBuoy className="h-4 w-4 mr-2" /> },
    ]

    return (
        <div className="flex h-full w-full flex-col">
            <header className="border-b border-border p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground">
                        <Button variant="ghost" size="sm" className="gap-1">
                            <ChevronLeft className="h-4 w-4" />
                            Back to Askova
                        </Button>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                                await db.clearAllData();
                                router.push("/quiz");
                                await signOut({ 
                                    redirect: false,
                                });
                            }}
                        >
                            Sign out
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="flex h-full w-full">
                    <ScrollArea className="w-full h-full">
                        <div className="mx-auto max-w-4xl p-4 pb-36">
                            {/* Profile header */}
                            <div className="mb-8 flex items-center space-x-4">
                                <Avatar className="h-20 w-20">
                                    {session?.user?.image ? (
                                        <AvatarImage src={session.user.image} alt={session.user.name ?? ""} />
                                    ) : (
                                        <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                                            {session?.user?.name?.[0] ?? "A"}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div>
                                    <h1 className="text-2xl font-bold">{session?.user?.name ?? "Askova User"}</h1>
                                    <p className="text-muted-foreground">{session?.user?.email ?? "user@example.com"}</p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <Card className="mb-8">
                                <Tabs value={activeTab} className="w-full">
                                    <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full h-auto">
                                        {tabs.map((tab) => (
                                            <TabsTrigger
                                                key={tab.id}
                                                value={tab.id}
                                                className="flex items-center py-2"
                                                asChild
                                            >
                                                <Link href={`/settings/${tab.id}`}>
                                                    <span className="flex items-center">
                                                        {tab.icon}
                                                        <span className="hidden sm:inline">{tab.label}</span>
                                                    </span>
                                                </Link>
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                            </Card>

                            {/* Content */}
                            <div className="min-h-[400px]">
                                {children}
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    )
}
