"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "../_components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../_components/ui/card"
import { useRouter } from "next/navigation"
import { DiscIcon as DiscordLogoIcon } from "lucide-react"

export default function AuthPage() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleDiscordLogin = async () => {
        try {
            setIsLoading(true)
            await signIn("discord", { callbackUrl: "/" })
        } catch (error) {
            console.error("Login failed:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                    <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        className="w-full h-12 text-white font-medium text-base transition-all hover:scale-[1.02] hover:shadow-md bg-[#5865F2] hover:bg-[#4752c4] flex items-center justify-center gap-3"
                        onClick={handleDiscordLogin}
                        disabled={isLoading}
                    >
                        <DiscordLogoIcon className="h-6 w-6" />
                        <span>Continue with Discord</span>
                    </Button>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <p className="text-xs text-center text-muted-foreground px-6">
                        By signing in, you agree to our{" "}
                        <button
                            onClick={() => router.push("/terms-of-service")}
                            className="underline underline-offset-2 hover:text-primary"
                        >
                            Terms of Service
                        </button>{" "}
                        and{" "}
                        <button
                            onClick={() => router.push("/privacy-policy")}
                            className="underline underline-offset-2 hover:text-primary"
                        >
                            Privacy Policy
                        </button>
                        .
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}

