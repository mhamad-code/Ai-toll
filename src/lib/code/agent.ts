import {
  buildPreview,
  fileList,
  loadFiles,
  normalizePath,
  runShell,
  saveFiles,
  type ProjectFiles,
  type TerminalLine,
} from "@/lib/code/workspace"
import { streamChat, type ApiMessage, type ToolCall, type ToolSpec } from "@/lib/chat-stream"
import type { Provider } from "@/lib/providers"
import type { SavedModel } from "@/lib/store"

/** The four tool families the activity row knows how to describe. */
export type ActionKind = "think" | "cmd" | "browser" | "read" | "edit"

export type AgentGroup = {
  id: string
  actions: ActionKind[]
  details: [string, string][]
  status: "running" | "done"
  current?: ActionKind
  summary?: string
}

export type AgentBlock =
  | { kind: "text"; id: string; text: string; final?: boolean }
  | { kind: "group"; id: string; data: AgentGroup }

export type AgentEvent =
  | { type: "blocks"; blocks: AgentBlock[] }
  | { type: "files"; files: ProjectFiles }
  | { type: "terminal"; command: string; lines: TerminalLine[] }
  | { type: "preview"; path: string; html: string }
  | { type: "error"; message: string }

export const CATS: Record<string, { one: string; many: string }> = {
  cmd: { one: "ran a command", many: "ran commands" },
  browser: { one: "used the browser", many: "used the browser" },
  read: { one: "read a file", many: "read files" },
  edit: { one: "edited a file", many: "edited files" },
}

export const RUNNING: Record<string, string> = {
  think: "Thinking…",
  cmd: "Running a command…",
  browser: "Using the browser…",
  read: "Reading files…",
  edit: "Editing files…",
}

/** Same summary the reference mockup builds: order of first use, no numbers. */
export function summarize(actions: ActionKind[]) {
  const order: string[] = []
  const counts: Record<string, number> = {}
  for (const a of actions) {
    if (a === "think") continue
    if (!(a in counts)) {
      counts[a] = 0
      order.push(a)
    }
    counts[a]++
  }
  const parts = order.map((a) => (counts[a] === 1 ? CATS[a].one : CATS[a].many))
  const s = parts.join(", ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Star for thinking, then the first tool decides the glyph. */
export function iconKind(actions: ActionKind[]): ActionKind {
  if (actions.includes("think")) return "think"
  return actions.find((a) => a !== "think") ?? "cmd"
}

const TOOLS: ToolSpec[] = [
  {
    name: "list_files",
    description: "List every file in the browser workspace. Call this before editing something you have not seen in this turn.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_file",
    description: "Read one file of the workspace by its relative path.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path, e.g. index.html" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with its complete new content. This is how a project is built. Always send the whole file, never a fragment.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path, e.g. index.html or src/app.js" },
        content: { type: "string", description: "The complete file content." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_file",
    description: "Remove a file from the workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "run_command",
    description:
      "Run a command in the built-in terminal against the workspace: ls, cat, node <file>, npm run build (validates every page and script), git status, preview. Use it to test your work.",
    parameters: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "preview",
    description: "Open the built page in the preview panel so it can be checked. Use it after building or fixing a page.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Page to show; defaults to index.html" } },
      additionalProperties: false,
    },
  },
]

export const CODE_SYSTEM = [
  "You are the coding agent of Ai Tool's Code section. You work inside a browser workspace (root /project) that belongs to the user.",
  "You build real, complete projects there: web pages, small apps and tools. Write every file whole with write_file, with relative paths (index.html, styles.css, app.js, src/…).",
  "Work in small honest steps: look at what exists, write the files, then test with run_command. `npm run build` checks every page and script for syntax and missing local files, `node file.js` executes it, `preview` renders it. Fix what fails before you call the work done.",
  "When the user wants a site or app, make it look finished: real layout, typography, colour, empty states, mobile widths. No placeholders like \"lorem ipsum\" unless they asked for a mockup.",
  "Then open the preview so the user sees the result.",
  "Reply in the user's own language (Arabic if they wrote Arabic), briefly: what you built, where the files are, what you checked. Never narrate every tool call — the activity rows already show them.",
  "If the request is ambiguous about something that changes the result, build the smallest sensible version and say which assumption you made.",
].join("\n")

export type CodeAgentOptions = {
  provider: Provider
  model: SavedModel
  apiKey: string
  prompt: string
  signal: AbortSignal
  sink: (event: AgentEvent) => void
  /** Earlier turns, so follow-ups keep their context. */
  history?: { role: "user" | "assistant"; content: string }[]
  reasoning?: boolean
  maxSteps?: number
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

const short = (text: string, max = 80) =>
  text.replace(/\s+/g, " ").trim().slice(0, max)

/**
 * Runs the coding agent: the model decides, the tools change real files, and
 * every step is reported as the activity rows of the reference design.
 */
export async function runCodeAgent(options: CodeAgentOptions) {
  const { provider, model, apiKey, prompt, signal, sink } = options
  const maxSteps = options.maxSteps ?? 14
  let files = loadFiles()

  const blocks: AgentBlock[] = []
  const emitBlocks = () => sink({ type: "blocks", blocks: blocks.map((b) => ({ ...b })) })

  let group: AgentGroup | null = null
  const liveGroup = () => group
  let thinking = false
  let thinkingSince = 0

  const startGroup = () => {
    if (group) return group
    const data: AgentGroup = {
      id: crypto.randomUUID(),
      actions: [],
      details: [],
      status: "running",
    }
    group = data
    blocks.push({ kind: "group", id: data.id, data })
    return data
  }

  const act = (kind: ActionKind, detail?: [string, string]) => {
    const g = startGroup()
    g.actions.push(kind)
    g.current = kind
    if (detail) g.details.push(detail)
    emitBlocks()
  }

  const flushGroup = () => {
    if (!group) return
    if (thinking && thinkingSince) {
      const seconds = Math.max(1, Math.round((Date.now() - thinkingSince) / 1000))
      group.details.push(["Thought", `for ${seconds}s`])
    }
    thinkingSince = 0
    group.status = "done"
    group.summary = summarize(group.actions)
    group.current = undefined
    group = null
    thinking = false
    emitBlocks()
  }

  let textBlock: { kind: "text"; id: string; text: string; final?: boolean } | null = null
  const pushText = (delta: string, final: boolean) => {
    flushGroup()
    if (!textBlock) {
      textBlock = { kind: "text", id: crypto.randomUUID(), text: "", final }
      blocks.push(textBlock)
    }
    textBlock.text += delta
    emitBlocks()
  }

  const apiMessages: ApiMessage[] = [
    ...(options.history ?? []),
    {
      role: "user",
      content: `${prompt}\n\nWorkspace files: ${
        fileList(files).length ? fileList(files).join(", ") : "(empty)"
      }`,
    },
  ]

  try {
    for (let step = 0; step < maxSteps; step++) {
      if (signal.aborted) break
      let calls: ToolCall[] = []
      let stepText = ""
      textBlock = null

      for await (const event of streamChat({
        provider,
        model: model.id,
        apiKey,
        messages: apiMessages,
        system: CODE_SYSTEM,
        tools: TOOLS,
        reasoning: options.reasoning ?? false,
        signal,
      })) {
        if (event.type === "reasoning") {
          const g = liveGroup()
          if (g && g.actions.length && !thinking) flushGroup()
          if (!thinking) {
            thinkingSince = Date.now()
            act("think")
            thinking = true
          } else {
            emitBlocks()
          }
        } else if (event.type === "text") {
          stepText += event.delta
          pushText(event.delta, false)
        } else if (event.type === "tool_calls") {
          calls = event.calls
        }
      }

      if (!calls.length) {
        if (textBlock) {
          const last = textBlock as { final?: boolean }
          last.final = true
          emitBlocks()
        }
        break
      }

      apiMessages.push({
        role: "assistant",
        content: stepText || null,
        tool_calls: calls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: c.arguments },
        })),
      })

      for (const call of calls) {
        if (signal.aborted) break
        const args = parseArgs(call.arguments)
        let output = ""
        try {
          switch (call.name) {
            case "list_files": {
              act("read", ["Listed", `${fileList(files).length} files`])
              output = fileList(files).length
                ? fileList(files).map((p) => `${p} (${files[p].length} bytes)`).join("\n")
                : "The workspace is empty."
              break
            }
            case "read_file": {
              const path = normalizePath(String(args.path ?? ""))
              const content = files[path]
              act("read", ["Read", path || "?"])
              output = content === undefined ? `No file at ${path}.` : content.slice(0, 30000)
              break
            }
            case "write_file": {
              const path = normalizePath(String(args.path ?? ""))
              const content = String(args.content ?? "")
              if (!path) throw new Error("write_file needs a path")
              files = { ...files, [path]: content }
              saveFiles(files)
              sink({ type: "files", files })
              act("edit", ["Edited", path])
              output = `Wrote ${path} (${content.length} bytes).`
              break
            }
            case "delete_file": {
              const path = normalizePath(String(args.path ?? ""))
              if (files[path] === undefined) throw new Error(`No file at ${path}`)
              files = { ...files }
              delete files[path]
              saveFiles(files)
              sink({ type: "files", files })
              act("edit", ["Deleted", path])
              output = `Deleted ${path}.`
              break
            }
            case "run_command": {
              const command = String(args.command ?? "").trim()
              act("cmd", ["Ran", short(command, 60)])
              const result = runShell(files, command)
              if (result.files !== files) {
                files = result.files
                saveFiles(files)
                sink({ type: "files", files })
              }
              sink({ type: "terminal", command, lines: result.lines })
              if (result.preview) {
                act("browser", ["Opened", result.preview.path])
                sink({ type: "preview", path: result.preview.path, html: result.preview.html })
              }
              output = result.lines.map((l) => l.text).join("\n").slice(0, 20000) || "(no output)"
              break
            }
            case "preview": {
              const path = String(args.path ?? "")
              const built = buildPreview(files, path || undefined)
              if (!built) throw new Error("There is no HTML page to preview yet.")
              act("browser", ["Opened", built.path])
              sink({ type: "preview", path: built.path, html: built.html })
              output = `Showing ${built.path} in the preview.`
              break
            }
            default:
              throw new Error(`Unknown tool: ${call.name}`)
          }
        } catch (error) {
          output = `Error: ${error instanceof Error ? error.message : String(error)}`
        }
        apiMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: output.slice(0, 20000),
        })
      }
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError"
    if (!aborted) {
      sink({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } finally {
    flushGroup()
    emitBlocks()
  }
}
