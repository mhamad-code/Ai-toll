import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

import { asJson, type RuntimeTool } from "@/lib/connectors/types"

/** The connector waiting for its OAuth redirect to come back. */
export const PENDING_KEY = "ai-toll:mcp:pending"

const read = <T>(key: string): T | undefined => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked.
  }
}

/** OAuth for a remote MCP server, kept in this browser. No keys to paste. */
class BrowserOAuthProvider implements OAuthClientProvider {
  private id: string

  constructor(id: string) {
    this.id = id
  }

  private key(name: string) {
    return `ai-toll:mcp:${this.id}:${name}`
  }

  get redirectUrl() {
    return `${window.location.origin}${window.location.pathname}`
  }

  get clientMetadata() {
    return {
      client_name: "Ai Tool",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }
  }

  clientInformation() {
    return read<never>(this.key("client"))
  }

  saveClientInformation(info: unknown) {
    write(this.key("client"), info)
  }

  tokens() {
    return read<never>(this.key("tokens"))
  }

  saveTokens(tokens: unknown) {
    write(this.key("tokens"), tokens)
  }

  saveCodeVerifier(verifier: string) {
    localStorage.setItem(this.key("verifier"), verifier)
  }

  codeVerifier() {
    return localStorage.getItem(this.key("verifier")) ?? ""
  }

  redirectToAuthorization(url: URL) {
    localStorage.setItem(PENDING_KEY, this.id)
    window.location.assign(url.toString())
  }

  clear() {
    for (const name of ["client", "tokens", "verifier"]) {
      localStorage.removeItem(this.key(name))
    }
  }
}

const clients = new Map<string, Client>()
const toolCache = new Map<string, RuntimeTool[]>()

function transportFor(url: string, provider: BrowserOAuthProvider, sse: boolean) {
  const target = new URL(url)
  return sse || target.pathname.endsWith("/sse")
    ? new SSEClientTransport(target, { authProvider: provider })
    : new StreamableHTTPClientTransport(target, { authProvider: provider })
}

/**
 * Connects to the server. If it needs a login, the page is sent to the
 * server's own authorization page and "redirect" is returned.
 */
export async function connectMcp(
  id: string,
  url: string
): Promise<"connected" | "redirect"> {
  const provider = new BrowserOAuthProvider(id)
  let lastError: unknown
  for (const sse of [false, true]) {
    const client = new Client({ name: "ai-toll", version: "1.0.0" })
    try {
      await client.connect(transportFor(url, provider, sse))
      clients.set(id, client)
      return "connected"
    } catch (error) {
      if (error instanceof UnauthorizedError) return "redirect"
      lastError = error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Couldn't reach the server.")
}

/** Second half of the login: swaps the code from the redirect for tokens. */
export async function finishMcpOAuth(id: string, url: string, code: string) {
  const provider = new BrowserOAuthProvider(id)
  const first = transportFor(url, provider, false)
  await first.finishAuth(code)
  const client = new Client({ name: "ai-toll", version: "1.0.0" })
  await client.connect(transportFor(url, provider, false))
  clients.set(id, client)
}

export async function disconnectMcp(id: string) {
  try {
    await clients.get(id)?.close()
  } catch {
    // Already closed.
  }
  clients.delete(id)
  toolCache.delete(id)
  new BrowserOAuthProvider(id).clear()
}

type McpTool = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; title?: string }
}

function resultText(result: { content?: unknown; isError?: boolean }) {
  const parts = Array.isArray(result.content) ? result.content : []
  const text = parts
    .map((p: { type?: string; text?: string; resource?: unknown }) =>
      p.type === "text"
        ? (p.text ?? "")
        : p.type === "resource"
          ? asJson(p.resource, 2000)
          : `[${p.type ?? "content"}]`
    )
    .join("\n")
  if (result.isError) throw new Error(text || "The tool reported an error.")
  return text.length > 20000 ? `${text.slice(0, 20000)}\n…(truncated)` : text
}

export async function mcpTools(
  id: string,
  name: string,
  url: string
): Promise<RuntimeTool[]> {
  const cached = toolCache.get(id)
  if (cached) return cached

  let client = clients.get(id)
  if (!client) {
    const state = await connectMcp(id, url)
    if (state === "redirect") {
      throw new Error(`${name} needs you to sign in again. Reconnect it in Connectors.`)
    }
    client = clients.get(id)
  }
  if (!client) throw new Error(`Couldn't reach ${name}.`)

  const { tools } = (await client.listTools()) as { tools: McpTool[] }
  const live = client
  const result = tools.map((tool, index): RuntimeTool => {
    const safe = `${id}__${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, "_")
    return {
      name: `${safe.slice(0, 60)}${index > 99 ? index : ""}`,
      label: tool.name,
      connectorId: id,
      connectorName: name,
      description: tool.description ?? tool.annotations?.title ?? tool.name,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
      write: tool.annotations?.readOnlyHint !== true,
      run: async (args) =>
        resultText(
          (await live.callTool({ name: tool.name, arguments: args })) as {
            content?: unknown
            isError?: boolean
          }
        ),
    }
  })
  toolCache.set(id, result)
  return result
}
