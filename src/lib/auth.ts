import * as React from "react"
import { getApps, initializeApp } from "firebase/app"
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth"

import { firebaseConfig } from "@/lib/firebase-config"

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
)

const app = isFirebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null
const auth: Auth | null = app ? getAuth(app) : null

function requireAuth(): Auth {
  if (!auth) throw new Error("Firebase isn't configured yet.")
  return auth
}

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(requireAuth(), email, password)

export const signUpWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(requireAuth(), email, password)

export const signInWithGoogle = () =>
  signInWithPopup(requireAuth(), new GoogleAuthProvider())

export const signInWithGitHub = () => {
  const provider = new GithubAuthProvider()
  provider.addScope("user:email")
  return signInWithPopup(requireAuth(), provider)
}

/**
 * Opens the provider's own consent window for extra permissions and returns
 * the access token, so the user never pastes a key. If the account is already
 * linked the window re-authorizes it; otherwise the provider gets linked.
 */
export async function signInWithOAuthToken(
  kind: "github" | "google",
  scopes: string[]
): Promise<string> {
  const firebase = requireAuth()
  const provider =
    kind === "github" ? new GithubAuthProvider() : new GoogleAuthProvider()
  scopes.forEach((scope) => provider.addScope(scope))

  const user = firebase.currentUser
  const providerId = kind === "github" ? "github.com" : "google.com"
  const result = !user
    ? await signInWithPopup(firebase, provider)
    : user.providerData.some((p) => p.providerId === providerId)
      ? await reauthenticateWithPopup(user, provider)
      : await linkWithPopup(user, provider)

  const credential =
    kind === "github"
      ? GithubAuthProvider.credentialFromResult(result)
      : GoogleAuthProvider.credentialFromResult(result)
  if (!credential?.accessToken) {
    throw new Error("The provider didn't return an access token.")
  }
  return credential.accessToken
}

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(requireAuth(), email)

export const logout = () => signOut(requireAuth())

export function useAuth() {
  const [state, setState] = React.useState<{
    user: User | null
    loading: boolean
  }>({ user: null, loading: Boolean(auth) })

  React.useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false }))
  }, [])

  return state
}

/** A readable message for a Firebase error, or null when the user just closed the popup. */
export function describeAuthError(error: unknown): string | null {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : ""

  switch (code) {
    case "auth/cancelled-popup-request":
      return null
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before it finished. If it closed by itself, check the provider setup in Firebase."
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password."
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in."
    case "auth/weak-password":
      return "Choose a password with at least 6 characters."
    case "auth/invalid-email":
      return "That email address doesn't look right."
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again."
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again."
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again."
    case "auth/account-exists-with-different-credential":
      return "This email is already registered with another sign-in method. Use that one."
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled in Firebase yet."
    case "auth/unauthorized-domain":
      return "This site's domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains."
    case "auth/credential-already-in-use":
      return "That account is already linked to another user of this app."
    case "auth/requires-recent-login":
      return "Sign in again, then retry."
    case "auth/user-disabled":
      return "This account has been disabled."
    default:
      return error instanceof Error ? error.message : "Something went wrong."
  }
}
