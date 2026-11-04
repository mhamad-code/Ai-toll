import { deleteChatDb } from "@/lib/chat-db"
import { userPrefix } from "@/lib/scope"

/** Deletes everything this device holds for one user: keys, tokens, chats. */
export async function eraseUserData(scope: string) {
  const prefix = userPrefix(scope)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) localStorage.removeItem(k)
    }
  } catch {
    // Storage blocked.
  }
  await deleteChatDb(scope)
}
