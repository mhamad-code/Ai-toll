/**
 * Everything saved on this device belongs to one signed-in user. Each user
 * gets a separate namespace, so signing in with another account never shows
 * the first account's keys, connectors or chats.
 */
const PREFIX = "ai-toll:u:"

let scope: string | null = null
let cleaned = false
const resets = new Set<() => void>()

export const chatDbName = (id: string) => `ai-toll-chats:${id}`

export const userPrefix = (id: string) => `${PREFIX}${id}:`

function key(name: string): string | null {
  return scope ? `${userPrefix(scope)}${name}` : null
}

export function readItem(name: string): string | null {
  const k = key(name)
  if (!k) return null
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export function writeItem(name: string, value: string) {
  const k = key(name)
  if (!k) return
  try {
    localStorage.setItem(k, value)
  } catch {
    // Storage blocked or full.
  }
}

export function removeItem(name: string) {
  const k = key(name)
  if (!k) return
  try {
    localStorage.removeItem(k)
  } catch {
    // Storage blocked.
  }
}

/** Runs when the active user changes: stores reload (or empty) themselves. */
export function onScopeChange(reset: () => void) {
  resets.add(reset)
  return () => {
    resets.delete(reset)
  }
}

/** Removes data saved before accounts were separated; it had no owner. */
function wipeLegacy() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith("ai-toll:") && !k.startsWith(PREFIX)) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    // Storage blocked.
  }
}

/** `null` means nobody is signed in: nothing can be read or written. */
export function switchScope(next: string | null) {
  if (!cleaned) {
    cleaned = true
    wipeLegacy()
  }
  if (next === scope) return
  scope = next
  resets.forEach((reset) => reset())
}
