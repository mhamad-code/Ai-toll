import { getToken } from "@/lib/connectors/store"
import {
  asJson,
  need,
  schema,
  str,
  type RuntimeTool,
} from "@/lib/connectors/types"

export const GOOGLE_SCOPES = {
  gmail: ["https://www.googleapis.com/auth/gmail.readonly"],
  gcalendar: ["https://www.googleapis.com/auth/calendar"],
  gdrive: ["https://www.googleapis.com/auth/drive.readonly"],
}

async function google<T = unknown>(
  connector: "gmail" | "gcalendar" | "gdrive",
  url: string,
  init?: RequestInit
): Promise<T> {
  const { token, expired } = getToken(connector)
  if (!token || expired) {
    throw new Error("The Google session expired. Reconnect it in Connectors.")
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  })
  if (res.status === 401) {
    throw new Error("The Google session expired. Reconnect it in Connectors.")
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`Google ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : null) as T
}

function make(
  connectorId: "gmail" | "gcalendar" | "gdrive",
  connectorName: string,
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  write: boolean,
  run: RuntimeTool["run"]
): RuntimeTool {
  return {
    name: `${connectorId}_${name}`,
    label: name.replace(/_/g, " "),
    connectorId,
    connectorName,
    description,
    parameters,
    write,
    run,
  }
}

/* ------------------------------------------------------------------ Gmail */

type GmailPart = {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

const fromB64Url = (data: string) => {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function findBody(part: GmailPart | undefined, mime: string): string | null {
  if (!part) return null
  if (part.mimeType === mime && part.body?.data) return fromB64Url(part.body.data)
  for (const child of part.parts ?? []) {
    const found = findBody(child, mime)
    if (found) return found
  }
  return null
}

export function gmailTools(): RuntimeTool[] {
  const base = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
  return [
    make("gmail", "Gmail", "search", "Search email with Gmail's query syntax (from:, subject:, is:unread, newer_than:7d…). Returns sender, subject, date and a snippet.", schema({
      query: { type: "string" },
      max: { type: "number", description: "How many results (max 20). Default 10." },
    }, ["query"]), false, async (a) => {
      need(a, "query")
      const n = Math.min(Number(a.max) || 10, 20)
      const list = await google<{ messages?: { id: string }[] }>("gmail", `${base}?maxResults=${n}&q=${encodeURIComponent(str(a, "query"))}`)
      const items = await Promise.all((list.messages ?? []).map(async (m) => {
        const msg = await google<{ id: string; snippet: string; payload?: { headers?: { name: string; value: string }[] } }>("gmail", `${base}/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
        const header = (name: string) => msg.payload?.headers?.find((h) => h.name === name)?.value
        return { id: msg.id, from: header("From"), subject: header("Subject"), date: header("Date"), snippet: msg.snippet }
      }))
      return asJson(items)
    }),

    make("gmail", "Gmail", "read", "Read one email by id (from gmail_search). Returns its text.", schema({
      id: { type: "string" },
    }, ["id"]), false, async (a) => {
      need(a, "id")
      const msg = await google<{ id: string; payload?: GmailPart & { headers?: { name: string; value: string }[] } }>("gmail", `${base}/${encodeURIComponent(str(a, "id"))}?format=full`)
      const header = (name: string) => msg.payload?.headers?.find((h) => h.name === name)?.value
      const plain = findBody(msg.payload, "text/plain")
      const html = plain ? null : findBody(msg.payload, "text/html")
      const text = plain ?? (html ? html.replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ") : "")
      return asJson({ id: msg.id, from: header("From"), to: header("To"), subject: header("Subject"), date: header("Date"), body: text.slice(0, 8000) })
    }),
  ]
}

/* --------------------------------------------------------------- Calendar */

export function calendarTools(): RuntimeTool[] {
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  return [
    make("gcalendar", "Google Calendar", "list_events", "List upcoming events on the primary calendar.", schema({
      time_min: { type: "string", description: "ISO 8601 start. Defaults to now." },
      time_max: { type: "string", description: "ISO 8601 end." },
      max: { type: "number", description: "How many events (max 50). Default 15." },
    }), false, async (a) => {
      const n = Math.min(Number(a.max) || 15, 50)
      const min = str(a, "time_min") || new Date().toISOString()
      const max = str(a, "time_max")
      const r = await google<{ items?: { id: string; summary?: string; location?: string; htmlLink: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }[] }>("gcalendar", `${base}?singleEvents=true&orderBy=startTime&maxResults=${n}&timeMin=${encodeURIComponent(min)}${max ? `&timeMax=${encodeURIComponent(max)}` : ""}`)
      return asJson((r.items ?? []).map((e) => ({ id: e.id, title: e.summary, start: e.start.dateTime ?? e.start.date, end: e.end.dateTime ?? e.end.date, location: e.location, url: e.htmlLink })))
    }),

    make("gcalendar", "Google Calendar", "create_event", "Create an event on the primary calendar. Changes the calendar.", schema({
      summary: { type: "string", description: "Event title." },
      start: { type: "string", description: "ISO 8601 start, e.g. 2026-11-05T15:00:00." },
      end: { type: "string", description: "ISO 8601 end." },
      description: { type: "string" },
      location: { type: "string" },
      time_zone: { type: "string", description: "IANA zone such as Asia/Beirut. Defaults to the browser's." },
    }, ["summary", "start", "end"]), true, async (a) => {
      need(a, "summary", "start", "end")
      const timeZone = str(a, "time_zone") || Intl.DateTimeFormat().resolvedOptions().timeZone
      const r = await google<{ id: string; htmlLink: string }>("gcalendar", base, {
        method: "POST",
        body: JSON.stringify({
          summary: str(a, "summary"),
          description: str(a, "description") || undefined,
          location: str(a, "location") || undefined,
          start: { dateTime: str(a, "start"), timeZone },
          end: { dateTime: str(a, "end"), timeZone },
        }),
      })
      return asJson({ ok: true, id: r.id, url: r.htmlLink })
    }),
  ]
}

/* ------------------------------------------------------------------ Drive */

export function driveTools(): RuntimeTool[] {
  return [
    make("gdrive", "Google Drive", "search", "Search files in Google Drive by name or content.", schema({
      query: { type: "string" },
      max: { type: "number", description: "How many files (max 30). Default 15." },
    }, ["query"]), false, async (a) => {
      need(a, "query")
      const n = Math.min(Number(a.max) || 15, 30)
      const q = str(a, "query").replace(/\\/g, "\\\\").replace(/'/g, "\\'")
      const query = `(name contains '${q}' or fullText contains '${q}') and trashed = false`
      const r = await google<{ files?: { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string }[] }>("gdrive", `https://www.googleapis.com/drive/v3/files?pageSize=${n}&fields=${encodeURIComponent("files(id,name,mimeType,modifiedTime,webViewLink)")}&q=${encodeURIComponent(query)}`)
      return asJson((r.files ?? []).map((f) => ({ name: f.name, type: f.mimeType, modified: f.modifiedTime, url: f.webViewLink })))
    }),
  ]
}
