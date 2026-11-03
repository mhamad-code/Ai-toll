import type { User } from "firebase/auth"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { isFirebaseConfigured, logout } from "@/lib/auth"
import { HOVER_SHADOW } from "@/lib/ui"

const PROVIDER_NAMES: Record<string, string> = {
  password: "Email",
  "google.com": "Google",
  "github.com": "GitHub",
}

export function AccountPage({ user }: { user: User | null }) {
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
          <CardFooter>
            <Button
              variant="outline"
              className={HOVER_SHADOW}
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
