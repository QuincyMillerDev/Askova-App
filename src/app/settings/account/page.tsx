import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/app/components/ui/card"
import { Button } from "~/app/components/ui/button"
import { AlertCircle } from "lucide-react"
import { Label } from "~/app/components/ui/label"
import {Input} from "~/app/components/ui/input";
import {Alert, AlertDescription, AlertTitle} from "~/app/components/ui/alert";

export default function AccountSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your account profile information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" placeholder="Your name" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="your.email@example.com" />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button>Save Changes</Button>
                </CardFooter>
            </Card>

            <Card className="border-destructive/50">
                <CardHeader className="text-destructive">
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription className="text-destructive/80">
                        Permanently delete your account and all associated data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                            This action cannot be undone. All your data will be permanently removed.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button variant="destructive">Delete Account</Button>
                </CardFooter>
            </Card>
        </div>
    )
}

