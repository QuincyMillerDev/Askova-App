"use client"

import { useSearchParams } from "next/navigation"
import { Button } from "../../_components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../_components/ui/card"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
    const searchParams = useSearchParams()
    const error = searchParams.get("error")

    let errorMessage = "An unknown error occurred during authentication."

    if (error === "OAuthSignin") errorMessage = "Error starting the OAuth sign-in flow."
    if (error === "OAuthCallback") errorMessage = "Error in the OAuth callback."
    if (error === "OAuthCreateAccount") errorMessage = "Error creating OAuth user in the database."
    if (error === "EmailCreateAccount") errorMessage = "Error creating email user in the database."
    if (error === "Callback") errorMessage = "Error in the OAuth callback."
    if (error === "AccessDenied") errorMessage = "You do not have access to this resource."
    if (error === "Configuration") errorMessage = "There is a problem with the server configuration."

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Authentication Error</CardTitle>
                    <CardDescription>There was a problem signing you in</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-center text-muted-foreground">{errorMessage}</p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button asChild>
                        <Link href="/auth">Try Again</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
