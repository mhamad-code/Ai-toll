import * as React from "react"

import type { ChatMessageData } from "@/components/ui/message-list"
import type { MessageToolCallData } from "@/components/ui/message-parts"
import { requestApproval } from "@/lib/approvals"
import { loadConvs, saveConv } from "@/lib/chat-db"
import {
  streamChat,
  type ApiMessage,
  type ToolCall,
  type ToolSpec,
} from "@/lib/chat-stream"
import { detectQuestions, type QuestionSpec } from "@/lib/clarify"
import { loadTools } from "@/lib/connectors/runtime"
import type { RuntimeTool } from "@/lib/connectors/types"
import { buildSystemPrompt } from "@/lib/prompt"
import { encodeSource } from "@/lib/source-token"
import { providerById } from "@/lib/providers"
import type { SavedModel } from "@/lib/store"

export type Conv = {
  id: string
  title: string
  messages: ChatMessageData[]
  generating: boolean
  startedAt?: number
  /** Questions the assistant asked, by message id. */
  questions: Record<string, QuestionSpec[]>
  /** What the model actually wrote for messages shown differently. */
  raw: Record<string, string>
}

export type SendContext = {
  model: SavedModel | undefined
  apiKey: string | undefined
  /** Search the web while answering (OpenRouter models). */
  webSearch?: boolean
}

const cleanText = (text: string, max: number) =>
  text.replace(/\s+/g, " ").trim().slice(0, max)

/** Source chips for the end of an answer. */
function sourceChips(sources: { url: string; title: string; content?: string }[]) {
  return sources
    .slice(0, 6)
    .map(
      (s) =>
        `[[src:${encodeSource({
          title: cleanText(s.title, 70) || s.url,
          url: s.url,
          description: cleanText(s.content ?? "", 110) || undefined,
        })}]]`
    )
    .join(" ")
}

/** Assistant messages that report a problem start with this and stay out of the history. */
const ERROR_PREFIX = "⚠️ "
const MAX_STEPS = 8

const newConv = (): Conv => ({
  id: crypto.randomUUID(),
  title: "New chat",
  messages: [],
  generating: false,
  questions: {},
  raw: {},
})

function toApiMessages(
  messages: ChatMessageData[],
  raw: Record<string, string>
): ApiMessage[] {
  const turns: { role: "user" | "assistant"; content: string }[] = []
  for (const message of messages) {
    const content = raw[message.id] ?? message.content
    if (!content.trim()) continue
    if (content.startsWith(ERROR_PREFIX)) continue
    const role = message.sender === "user" ? "user" : "assistant"
    const last = turns[turns.length - 1]
    if (last && last.role === role) last.content += `\n\n${content}`
    else turns.push({ role, content })
  }
  while (turns.length && turns[0].role !== "user") turns.shift()
  return turns
}

function parseArgs(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text || "{}") as unknown
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function useChats(scope: string) {
  const [convs, setConvs] = React.useState<Conv[]>(() => [newConv()])
  const [loaded, setLoaded] = React.useState(false)
  const savedRef = React.useRef(new Map<string, Conv>())
  const [activeId, setActiveId] = React.useState(() => convs[0].id)
  const aborts = React.useRef(new Map<string, AbortController>())
  const convsRef = React.useRef(convs)

  React.useEffect(() => {
    convsRef.current = convs
  })

  // Earlier chats come back from this device's database.
  React.useEffect(() => {
    let cancelled = false
    loadConvs(scope)
      .then((stored) => {
        if (cancelled) return
        const restored: Conv[] = stored
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((c) => ({
            id: c.id,
            title: c.title,
            messages: c.messages,
            questions: c.questions ?? {},
            raw: c.raw ?? {},
            generating: false,
          }))
        restored.forEach((c) => savedRef.current.set(c.id, c))
        setConvs((prev) => [
          ...prev,
          ...restored.filter((c) => !prev.some((p) => p.id === c.id)),
        ])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [scope])

  // Save whatever changed, once a reply has finished.
  React.useEffect(() => {
    if (!loaded) return
    for (const c of convs) {
      if (c.generating || c.messages.length === 0) continue
      if (savedRef.current.get(c.id) === c) continue
      savedRef.current.set(c.id, c)
      saveConv(scope, {
        id: c.id,
        title: c.title,
        messages: c.messages,
        questions: c.questions,
        raw: c.raw,
        updatedAt: Date.now(),
      }).catch(() => {})
    }
  }, [convs, loaded, scope])

  // Leaving (sign-out or switching account) stops anything still running, so
  // a reply can't keep using the previous user's connectors.
  React.useEffect(() => {
    const running = aborts.current
    return () => running.forEach((controller) => controller.abort())
  }, [])

  const patch = React.useCallback(
    (id: string, update: (conv: Conv) => Conv) => {
      setConvs((prev) => prev.map((c) => (c.id === id ? update(c) : c)))
    },
    []
  )

  const appendAssistant = React.useCallback(
    (id: string, content: string) => {
      patch(id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: crypto.randomUUID(), sender: "assistant", content },
        ],
      }))
    },
    [patch]
  )

  const newChat = React.useCallback(() => {
    const current = convsRef.current.find((c) => c.id === activeId)
    if (current && current.messages.length === 0) return current.id
    const conv = newConv()
    setConvs((prev) => [conv, ...prev])
    setActiveId(conv.id)
    return conv.id
  }, [activeId])

  const stop = React.useCallback((id: string) => {
    aborts.current.get(id)?.abort()
  }, [])

  const send = React.useCallback(
    async (id: string, text: string, ctx: SendContext) => {
      const conv = convsRef.current.find((c) => c.id === id)
      if (!conv || conv.generating) return

      const userMessage: ChatMessageData = {
        id: crypto.randomUUID(),
        sender: "user",
        content: text,
      }
      const history = [...conv.messages, userMessage]
      const startedAt = Date.now()
      patch(id, (c) => ({
        ...c,
        title: c.messages.length ? c.title : text.slice(0, 40),
        messages: history,
        generating: true,
        startedAt,
      }))

      const provider = ctx.model ? providerById(ctx.model.provider) : undefined
      if (!ctx.model || !provider || !ctx.apiKey) {
        appendAssistant(
          id,
          `${ERROR_PREFIX}No model selected. Add a key on the Providers page, then add a model on the Models page.`
        )
        patch(id, (c) => ({ ...c, generating: false }))
        return
      }

      const controller = new AbortController()
      aborts.current.set(id, controller)

      // Tools: images and Wikipedia, plus the connectors that are switched on.
      let connectorTools: RuntimeTool[] = []
      try {
        connectorTools = await loadTools()
      } catch {
        connectorTools = []
      }
      const toolsSupported =
        ctx.model.tools !== false &&
        provider.kind !== "anthropic" &&
        provider.kind !== "google"
      if (connectorTools.length && !toolsSupported) {
        appendAssistant(
          id,
          `${ERROR_PREFIX}This model can't use connectors, so they are off for this reply. Pick a model with the Tools badge.`
        )
      }
      const runtimeTools: RuntimeTool[] = toolsSupported ? connectorTools : []
      const byName = new Map(runtimeTools.map((t) => [t.name, t]))
      const toolSpecs: ToolSpec[] = runtimeTools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }))

      const assistantId = crypto.randomUUID()
      const apiMessages = toApiMessages(history, conv.raw)
      const toolUi: MessageToolCallData[] = []
      const sources: { url: string; title: string; content?: string }[] = []
      let content = ""
      let reasoning = ""
      let reasoningStart = 0
      let reasoningSeconds = 0
      let needSeparator = false
      let timer: ReturnType<typeof setTimeout> | null = null
      let failure: string | null = null

      const render = (final = false) => {
        timer = null
        const detected = detectQuestions(content)
        // The form is still arriving: keep the waiting indicator instead.
        if (detected.status === "open" && !final) return
        const ready = detected.status === "ready" ? detected : null
        // A questions block that is broken or never closed is dropped, not shown as code.
        const dropped =
          detected.status === "broken" || detected.status === "open" ? detected : null
        const body = ready
          ? ready.text || "A few quick questions:"
          : dropped
            ? dropped.text || "I need a bit more detail. What exactly would you like to know?"
            : content
        const message: ChatMessageData = {
          id: assistantId,
          sender: "assistant",
          content: sources.length ? `${body}\n\n${sourceChips(sources)}` : body,
          reasoning: reasoning || null,
          reasoningDuration: reasoningSeconds || undefined,
          tools: toolUi.length ? toolUi.map((t) => ({ ...t })) : undefined,
        }
        patch(id, (c) => ({
          ...c,
          messages: c.messages.some((m) => m.id === assistantId)
            ? c.messages.map((m) => (m.id === assistantId ? message : m))
            : [...c.messages, message],
          questions: ready
            ? { ...c.questions, [assistantId]: ready.questions }
            : c.questions,
          raw:
            ready || dropped || sources.length
              ? { ...c.raw, [assistantId]: dropped ? body : content }
              : c.raw,
        }))
      }
      const schedule = () => {
        if (timer === null) timer = setTimeout(() => render(), 50)
      }

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          if (controller.signal.aborted) break
          let calls: ToolCall[] = []
          let stepText = ""

          for await (const event of streamChat({
            provider,
            model: ctx.model.id,
            apiKey: ctx.apiKey,
            messages: apiMessages,
            system: buildSystemPrompt(toolSpecs.length > 0),
            tools: toolSpecs,
            webSearch: Boolean(ctx.webSearch) && provider.kind === "openrouter",
            reasoning: ctx.model.reasoning ?? false,
            signal: controller.signal,
          })) {
            if (event.type === "reasoning") {
              if (!reasoning) reasoningStart = Date.now()
              reasoning += event.delta
            } else if (event.type === "text") {
              if (reasoning && !content && !reasoningSeconds) {
                reasoningSeconds = (Date.now() - reasoningStart) / 1000
              }
              if (needSeparator && content) content += "\n\n"
              needSeparator = false
              content += event.delta
              stepText += event.delta
            } else if (event.type === "sources") {
              for (const s of event.sources) {
                if (!sources.some((x) => x.url === s.url)) sources.push(s)
              }
            } else {
              calls = event.calls
            }
            schedule()
          }

          if (!calls.length) break

          apiMessages.push({
            role: "assistant",
            content: stepText || null,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: c.arguments },
            })),
          })

          for (const call of calls) {
            const tool = byName.get(call.name)
            const entry: MessageToolCallData = {
              id: call.id,
              name: call.name,
              status: "running",
              input: call.arguments,
            }
            toolUi.push(entry)
            schedule()

            let output = ""
            try {
              if (!tool) throw new Error(`Unknown tool: ${call.name}`)
              if (controller.signal.aborted) throw new Error("Stopped")
              const args = parseArgs(call.arguments)
              const allowed =
                !tool.write ||
                (await requestApproval({
                  title: `${tool.connectorName}: ${tool.label}`,
                  description: tool.description,
                  args,
                }))
              if (allowed && controller.signal.aborted) {
                throw new Error("Stopped")
              }
              if (allowed) {
                output = await tool.run(args)
                entry.status = "done"
              } else {
                output = "The user declined this action."
                entry.status = "error"
              }
            } catch (error) {
              output = `Error: ${error instanceof Error ? error.message : String(error)}`
              entry.status = "error"
            }
            entry.output = output.slice(0, 4000)
            apiMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: output.slice(0, 20000),
            })
            schedule()
          }
          needSeparator = true
        }
      } catch (error) {
        const aborted =
          error instanceof DOMException && error.name === "AbortError"
        if (!aborted) {
          failure = error instanceof Error ? error.message : String(error)
        }
      } finally {
        if (timer !== null) clearTimeout(timer)
        aborts.current.delete(id)
      }

      if (reasoning && !content && !reasoningSeconds) {
        reasoningSeconds = (Date.now() - reasoningStart) / 1000
      }
      if (content || reasoning || toolUi.length || sources.length) render(true)
      if (failure) appendAssistant(id, `${ERROR_PREFIX}${failure}`)
      patch(id, (c) => ({ ...c, generating: false }))
    },
    [appendAssistant, patch]
  )

  return { convs, activeId, setActiveId, newChat, send, stop }
}
