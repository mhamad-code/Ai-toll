import type { User } from "firebase/auth"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { isFirebaseConfigured, logout } from "@/lib/auth"
import { eraseUserData } from "@/lib/erase"
import { HOVER_SHADOW } from "@/lib/ui"

const PROVIDER_NAMES: Record<string, string> = {
  password: "Email",
  "google.com": "Google",
  "github.com": "GitHub",
}

export function AccountPage({ user }: { user: User | null }) {
  const [erasing, setErasing] = React.useState(false)

  async function signOutAndErase() {
    if (!user) return
    setErasing(true)
    await eraseUserData(user.uid)
    await logout()
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      {!isFirebaseConfigured ? (
        <Alert>
          <AlertTitle>Login isn't set up yet</AlertTitle>
          <AlertDescription>
            Paste your Firebase config into src/lib/firebase-config.ts and
            deploy again. Until then the app opens without a login screen.
          </AlertDescription>
        </Alert>
      ) : (
        <Card className={HOVER_SHADOW}>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user?.email ?? "Signed in"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {user?.providerData.map((p) => (
              <Badge key={p.providerId} variant="secondary">
                {PROVIDER_NAMES[p.providerId] ?? p.providerId}
              </Badge>
            ))}
          </CardContent>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your keys, connectors and chats stay on this device, separate for
              each account. Other accounts can't see them.
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className={HOVER_SHADOW}
              onClick={() => void logout()}
            >
              Sign out
            </Button>
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="destructive" className={HOVER_SHADOW}>
                    Sign out and erase data
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Erase data from this device?</DialogTitle>
                  <DialogDescription>
                    This deletes this account's API keys, connector logins and
                    chats from this device, then signs you out. It can't be
                    undone. Access you granted to GitHub or Google stays until
                    you remove it in their settings.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose
                    render={<Button variant="outline">Cancel</Button>}
                  />
                  <Button
                    variant="destructive"
                    disabled={erasing}
                    onClick={() => void signOutAndErase()}
                  >
                    Erase and sign out
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
