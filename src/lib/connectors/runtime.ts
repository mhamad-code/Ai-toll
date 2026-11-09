import { signInWithOAuthToken } from "@/lib/auth"
import {
  allConnectors,
  type Connector,
} from "@/lib/connectors/catalog"
import { githubTools } from "@/lib/connectors/github"
import {
  GOOGLE_SCOPES,
  calendarTools,
  driveTools,
  gmailTools,
} from "@/lib/connectors/google"
import {
  PENDING_KEY,
  connectMcp,
  disconnectMcp,
  finishMcpOAuth,
  mcpTools,
} from "@/lib/connectors/mcp"
import {
  clearToken,
  connectorActions,
  getConnectorState,
  saveToken,
  setNotice,
} from "@/lib/connectors/store"
import type { RuntimeTool } from "@/lib/connectors/types"
import { readItem, removeItem } from "@/lib/scope"

const GOOGLE_TOKEN_TTL = 55 * 60 * 1000

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * Connects a service. Nothing to paste: GitHub and Google open their own
 * sign-in window, remote servers send the page to their authorization screen.
 */
export async function connectConnector(c: Connector): Promise<void> {
  setNotice(null)
  try {
    if (c.native === "github") {
      const token = await signInWithOAuthToken("github", ["repo", "read:user", "user:email"])
      saveToken("github", token)
    } else if (c.native) {
      const token = await signInWithOAuthToken("google", GOOGLE_SCOPES[c.native])
      saveToken(c.native, token, GOOGLE_TOKEN_TTL)
    } else if (c.mcpUrl) {
      const state = await connectMcp(c.id, c.mcpUrl)
      if (state === "redirect") return // The page is on its way to the login screen.
    } else {
      throw new Error(`${c.name} can't be connected yet.`)
    }
    connectorActions.markConnected(c.id)
    setNotice({ kind: "info", text: `${c.name} connected.` })
  } catch (error) {
    setNotice({ kind: "error", text: `${c.name}: ${message(error)}` })
  }
}

export async function disconnectConnector(c: Connector): Promise<void> {
  if (c.native) clearToken(c.native)
  if (c.mcpUrl) await disconnectMcp(c.id)
  connectorActions.markDisconnected(c.id)
}

let handled = false

/** Finishes a remote server's login after the page comes back from it. */
export async function handleOAuthReturn(): Promise<boolean> {
  if (handled) return false
  const params = new URLSearchParams(window.location.search)
  const pending = readItem(PENDING_KEY)
  const code = params.get("code")
  const error = params.get("error")
  if (!pending || (!code && !error)) return false
  handled = true

  removeItem(PENDING_KEY)
  window.history.replaceState({}, "", window.location.pathname)

  const connector = allConnectors(getConnectorState().custom).find(
    (c) => c.id === pending
  )
  const name = connector?.name ?? "Connector"
  if (error) {
    setNotice({
      kind: "error",
      text: `${name}: ${params.get("error_description") ?? error}`,
    })
    return true
  }
  if (!connector?.mcpUrl || !code) return true

  try {
    await finishMcpOAuth(connector.id, connector.mcpUrl, code)
    connectorActions.markConnected(connector.id)
    setNotice({ kind: "info", text: `${name} connected.` })
  } catch (e) {
    setNotice({ kind: "error", text: `${name}: ${message(e)}` })
  }
  return true
}

async function toolsFor(c: Connector): Promise<RuntimeTool[]> {
  switch (c.native) {
    case "github":
      return githubTools()
    case "gmail":
      return gmailTools()
    case "gcalendar":
      return calendarTools()
    case "gdrive":
      return driveTools()
  }
  if (c.mcpUrl) return mcpTools(c.id, c.name, c.mcpUrl)
  return []
}

/** True when at least one connector is connected and switched on. */
export function hasActiveConnectors(): boolean {
  const state = getConnectorState()
  return Object.keys(state.enabled).some(
    (id) => state.enabled[id] && state.connected[id]
  )
}

/** Tools of every connector that is connected and switched on. */
export async function loadTools(): Promise<RuntimeTool[]> {
  const state = getConnectorState()
  const active = allConnectors(state.custom).filter(
    (c) => state.connected[c.id] && state.enabled[c.id]
  )
  const groups = await Promise.all(
    active.map((c) =>
      toolsFor(c).catch((error) => {
        console.warn(`Connector ${c.name} unavailable:`, error)
        return [] as RuntimeTool[]
      })
    )
  )
  return groups.flat().slice(0, 100)
}
