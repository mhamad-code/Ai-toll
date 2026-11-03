"use client"

import * as React from "react"
import { GalleryVerticalEnd, LoaderCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import {
  describeAuthError,
  resetPassword,
  signInWithEmail,
  signInWithGitHub,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth"

type Mode = "login" | "signup"
type Busy = null | "email" | "google" | "github"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
        fill="currentColor"
      />
    </svg>
  )
}

export function AuthPage() {
  const [mode, setMode] = React.useState<Mode>("login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [busy, setBusy] = React.useState<Busy>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

  const signup = mode === "signup"

  async function run(kind: Exclude<Busy, null>, action: () => Promise<unknown>) {
    setBusy(kind)
    setError(null)
    setInfo(null)
    try {
      await action()
    } catch (e) {
      setError(describeAuthError(e))
    } finally {
      setBusy(null)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (signup && password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    const address = email.trim()
    void run("email", () =>
      signup
        ? signUpWithEmail(address, password)
        : signInWithEmail(address, password)
    )
  }

  function handleForgot() {
    const address = email.trim()
    if (!address) {
      setError("Enter your email above first.")
      return
    }
    void run("email", async () => {
      await resetPassword(address)
      setInfo("Password reset email sent. Check your inbox.")
    })
  }

  function switchMode() {
    setMode(signup ? "login" : "signup")
    setError(null)
    setInfo(null)
  }

  const disabled = busy !== null

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle floating={false} />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Ai Tool
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">
                {signup ? "Create an account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {signup
                  ? "Sign up with your Google or GitHub account"
                  : "Login with your Google or GitHub account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={disabled}
                      onClick={() => void run("google", signInWithGoogle)}
                    >
                      {busy === "google" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <GoogleIcon />
                      )}
                      {signup ? "Sign up with Google" : "Login with Google"}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={disabled}
                      onClick={() => void run("github", signInWithGitHub)}
                    >
                      {busy === "github" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <GitHubIcon />
                      )}
                      {signup ? "Sign up with GitHub" : "Login with GitHub"}
                    </Button>
                  </Field>

                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    Or continue with
                  </FieldSeparator>

                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  {info ? (
                    <Alert>
                      <AlertDescription>{info}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      {!signup ? (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="ml-auto h-auto p-0"
                          disabled={disabled}
                          onClick={handleForgot}
                        >
                          Forgot your password?
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={signup ? "new-password" : "current-password"}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                  {signup ? (
                    <Field>
                      <FieldLabel htmlFor="confirm-password">
                        Confirm password
                      </FieldLabel>
                      <Input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <Button type="submit" disabled={disabled}>
                      {busy === "email" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : null}
                      {signup ? "Create account" : "Login"}
                    </Button>
                    <FieldDescription className="text-center">
                      {signup ? "Already have an account?" : "Don't have an account?"}{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 align-baseline"
                        disabled={disabled}
                        onClick={switchMode}
                      >
                        {signup ? "Login" : "Sign up"}
                      </Button>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
          <FieldDescription className="px-6 text-center">
            By clicking continue, you agree to our Terms of Service and Privacy
            Policy.
          </FieldDescription>
        </div>
      </div>
    </div>
  )
}
