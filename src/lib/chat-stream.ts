import type { Provider } from "@/lib/providers"

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }

export type StreamRequest = {
  provider: Provider
  model: string
  apiKey: string
  turns: ChatTurn[]
  /** Ask for visible thinking when the provider needs an opt-in. */
  reasoning: boolean
  signal: AbortSignal
}

export async function* streamChat(
  request: StreamRequest
): AsyncGenerator<StreamEvent> {
  switch (request.provider.kind) {
    case "anthropic":
      yield* anthropic(request)
      break
    case "google":
      yield* google(request)
      break
    default:
      yield* openaiCompatible(request)
  }
}

/* ---------------------------------------------------------------- helpers */

async function* readSSE(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error("The provider sent an empty response.")
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf("\n")
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "")
      buffer = buffer.slice(newline + 1)
      if (line.startsWith("data:")) yield line.slice(5).trim()
      newline = buffer.indexOf("\n")
    }
  }
  const rest = buffer.trim()
  if (rest.startsWith("data:")) yield rest.slice(5).trim()
}

function parse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T
  } catch {
    return null
  }
}

async function failure(res: Response, name: string): Promise<Error> {
  let detail = ""
  try {
    const json = (await res.json()) as {
      error?: { message?: string } | string
      message?: string
    }
    detail =
      (typeof json.error === "string" ? json.error : json.error?.message) ??
      json.message ??
      ""
  } catch {
    // Body wasn't JSON.
  }
  return new Error(
    `${name} returned ${res.status}${detail ? `: ${detail}` : ""}`
  )
}

/** Some models write their thinking inline as <think>…</think>. */
function createThinkSplitter() {
  const OPEN = "<think>"
  const CLOSE = "</think>"
  let inThink = false
  let pending = ""

  function* push(chunk: string): Generator<StreamEvent> {
    pending += chunk
    while (pending) {
      const tag = inThink ? CLOSE : OPEN
      const at = pending.indexOf(tag)
      if (at >= 0) {
        const before = pending.slice(0, at)
        if (before) {
          yield { type: inThink ? "reasoning" : "text", delta: before }
        }
        pending = pending.slice(at + tag.length)
        inThink = !inThink
        continue
      }
      // Hold back a possible half-arrived tag at the end of the chunk.
      let keep = 0
      for (let n = Math.min(tag.length - 1, pending.length); n > 0; n--) {
        if (pending.endsWith(tag.slice(0, n))) {
          keep = n
          break
        }
      }
      const out = pending.slice(0, pending.length - keep)
      if (out) yield { type: inThink ? "reasoning" : "text", delta: out }
      pending = pending.slice(pending.length - keep)
      break
    }
  }

  function* flush(): Generator<StreamEvent> {
    if (pending) {
      yield { type: inThink ? "reasoning" : "text", delta: pending }
      pending = ""
    }
  }

  return { push, flush }
}

/* ------------------------------------------------- OpenAI-compatible APIs */

type OpenAIChunk = {
  error?: { message?: string }
  choices?: {
    delta?: {
      content?: string | null
      reasoning?: string | null
      reasoning_content?: string | null
    }
  }[]
}

async function* openaiCompatible({
  provider,
  model,
  apiKey,
  turns,
  signal,
}: StreamRequest): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = { model, messages: turns, stream: true }
  if (provider.kind === "openrouter") body.include_reasoning = true

  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res, provider.name)

  const think = createThinkSplitter()
  for await (const data of readSSE(res)) {
    if (data === "[DONE]") break
    const chunk = parse<OpenAIChunk>(data)
    if (!chunk) continue
    if (chunk.error) throw new Error(chunk.error.message ?? "Stream error")
    const delta = chunk.choices?.[0]?.delta
    if (!delta) continue
    const reasoning = delta.reasoning ?? delta.reasoning_content
    if (typeof reasoning === "string" && reasoning) {
      yield { type: "reasoning", delta: reasoning }
    }
    if (typeof delta.content === "string" && delta.content) {
      yield* think.push(delta.content)
    }
  }
  yield* think.flush()
}

/* -------------------------------------------------------------- Anthropic */

type AnthropicEvent = {
  type?: string
  error?: { message?: string }
  delta?: { type?: string; text?: string; thinking?: string }
}

async function* anthropic({
  provider,
  model,
  apiKey,
  turns,
  signal,
}: StreamRequest): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${provider.baseURL}/messages`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages: turns,
    }),
  })
  if (!res.ok) throw await failure(res, provider.name)

  for await (const data of readSSE(res)) {
    const event = parse<AnthropicEvent>(data)
    if (!event) continue
    if (event.type === "error") {
      throw new Error(event.error?.message ?? "Stream error")
    }
    if (event.type !== "content_block_delta") continue
    if (event.delta?.type === "text_delta" && event.delta.text) {
      yield { type: "text", delta: event.delta.text }
    } else if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
      yield { type: "reasoning", delta: event.delta.thinking }
    }
  }
}

/* ----------------------------------------------------------------- Gemini */

type GeminiChunk = {
  error?: { message?: string }
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] }
  }[]
}

async function* google({
  provider,
  model,
  apiKey,
  turns,
  reasoning,
  signal,
}: StreamRequest): AsyncGenerator<StreamEvent> {
  const url =
    `${provider.baseURL}/models/${encodeURIComponent(model)}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(apiKey)}`
  const body: Record<string, unknown> = {
    contents: turns.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
  }
  if (reasoning) {
    body.generationConfig = { thinkingConfig: { includeThoughts: true } }
  }

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res, provider.name)

  for await (const data of readSSE(res)) {
    const chunk = parse<GeminiChunk>(data)
    if (!chunk) continue
    if (chunk.error) throw new Error(chunk.error.message ?? "Stream error")
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (!part.text) continue
      yield { type: part.thought ? "reasoning" : "text", delta: part.text }
    }
  }
}
