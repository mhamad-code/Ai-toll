import * as React from "react"

export type Page = "chat" | "providers" | "models" | "connectors" | "account"
export type Route = { page: Page; id?: string }

/** "/Ai-toll/" on GitHub Pages; always ends with a slash. */
const BASE = import.meta.env.BASE_URL
const EVENT = "ai-toll:navigate"

const PAGES = new Set<string>(["providers", "models", "connectors", "account"])

/** `/chat/<id>` is a conversation, `/` a fresh chat, the rest are pages. */
export function parseRoute(pathname: string): Route {
  const rest = pathname.startsWith(BASE)
    ? pathname.slice(BASE.length)
    : pathname.replace(/^\/+/, "")
  const [first, second] = rest.split("/").filter(Boolean)
  if (first && PAGES.has(first)) return { page: first as Page }
  if (first === "chat") {
    return { page: "chat", id: second ? decodeURIComponent(second) : undefined }
  }
  return { page: "chat" }
}

export function hrefFor(route: Route): string {
  if (route.page === "chat") {
    return route.id ? `${BASE}chat/${encodeURIComponent(route.id)}` : BASE
  }
  return `${BASE}${route.page}`
}

export function navigate(route: Route, replace = false) {
  const href = hrefFor(route)
  if (window.location.pathname === href && !window.location.search) return
  window.history[replace ? "replaceState" : "pushState"]({}, "", href)
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener("popstate", listener)
    window.removeEventListener(EVENT, listener)
  }
}

export function useRoute(): Route {
  const pathname = React.useSyncExternalStore(
    subscribe,
    () => window.location.pathname
  )
  return React.useMemo(() => parseRoute(pathname), [pathname])
}
