import * as React from "react"
import { getApps, initializeApp } from "firebase/app"
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
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
    case "auth/user-disabled":
      return "This account has been disabled."
    default:
      return error instanceof Error ? error.message : "Something went wrong."
  }
}
