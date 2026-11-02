import * as React from "react"

import type { ChatMessageData } from "@/components/ui/message-list"
import { streamChat, type ChatTurn } from "@/lib/chat-stream"
import { providerById } from "@/lib/providers"
import type { SavedModel } from "@/lib/store"

export type Conv = {
  id: string
  title: string
  messages: ChatMessageData[]
  generating: boolean
  startedAt?: number
}

export type SendContext = {
  model: SavedModel | undefined
  apiKey: string | undefined
}

/** Assistant messages that report a problem start with this and stay out of the history. */
const ERROR_PREFIX = "⚠️ "

const newConv = (): Conv => ({
  id: crypto.randomUUID(),
  title: "New chat",
  messages: [],
  generating: false,
})

function toTurns(messages: ChatMessageData[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (const message of messages) {
    if (!message.content.trim()) continue
    if (message.content.startsWith(ERROR_PREFIX)) continue
    const role = message.sender === "user" ? "user" : "assistant"
    const last = turns[turns.length - 1]
    if (last && last.role === role) last.content += `\n\n${message.content}`
    else turns.push({ role, content: message.content })
  }
  while (turns.length && turns[0].role !== "user") turns.shift()
  return turns
}

export function useChats() {
  const [convs, setConvs] = React.useState<Conv[]>(() => [newConv()])
  const [activeId, setActiveId] = React.useState(() => convs[0].id)
  const aborts = React.useRef(new Map<string, AbortController>())
  const convsRef = React.useRef(convs)

  React.useEffect(() => {
    convsRef.current = convs
  })

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

      const assistantId = crypto.randomUUID()
      let content = ""
      let reasoning = ""
      let reasoningStart = 0
      let reasoningSeconds = 0
      let timer: ReturnType<typeof setTimeout> | null = null
      let failure: string | null = null

      const render = () => {
        timer = null
        const message: ChatMessageData = {
          id: assistantId,
          sender: "assistant",
          content,
          reasoning: reasoning || null,
          reasoningDuration: reasoningSeconds || undefined,
        }
        patch(id, (c) => ({
          ...c,
          messages: c.messages.some((m) => m.id === assistantId)
            ? c.messages.map((m) => (m.id === assistantId ? message : m))
            : [...c.messages, message],
        }))
      }
      const schedule = () => {
        if (timer === null) timer = setTimeout(render, 50)
      }

      try {
        for await (const event of streamChat({
          provider,
          model: ctx.model.id,
          apiKey: ctx.apiKey,
          turns: toTurns(history),
          reasoning: ctx.model.reasoning ?? false,
          signal: controller.signal,
        })) {
          if (event.type === "reasoning") {
            if (!reasoning) reasoningStart = Date.now()
            reasoning += event.delta
          } else {
            if (reasoning && !content) {
              reasoningSeconds = (Date.now() - reasoningStart) / 1000
            }
            content += event.delta
          }
          schedule()
        }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError"
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
      if (content || reasoning) render()
      if (failure) appendAssistant(id, `${ERROR_PREFIX}${failure}`)
      patch(id, (c) => ({ ...c, generating: false }))
    },
    [appendAssistant, patch]
  )

  return { convs, activeId, setActiveId, newChat, send, stop }
}
