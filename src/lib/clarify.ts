/**
 * Clarifying questions. The model asks for them by replying with a fenced
 * block whose language is "questions"; the chat turns it into a questionnaire.
 */

export type QuestionChoice = { label: string; value: string; description?: string }

export type QuestionSpec = {
  name: string
  title: string
  description?: string
  multiple: boolean
  required: boolean
  choices: QuestionChoice[]
  /** Present when the user may type their own answer. */
  input?: { label: string; placeholder: string }
}

export type Detected =
  | { status: "none" }
  /** The block hasn't closed yet (still streaming, or cut off). */
  | { status: "open"; text: string }
  /** The block closed but isn't usable JSON. */
  | { status: "broken"; text: string }
  | { status: "ready"; questions: QuestionSpec[]; text: string }

const FENCE_START = "```questions"
const FENCE = /```questions[^\S\r\n]*\r?\n([\s\S]*?)```/

export const SYSTEM_PROMPT = [
  "You are a helpful assistant inside a chat app. Answer in the same language the user writes in.",
  "",
  "When a request is ambiguous, or you are missing details you really need to answer well, ask clarifying questions instead of guessing. Do it by replying with one fenced block whose language is \"questions\" and whose content is JSON, optionally preceded by one short sentence in the user's language. Example:",
  "",
  "```questions",
  '{"questions":[{"name":"goal","title":"What is this for?","description":"Pick one.","multiple":false,"required":true,"allowOther":true,"choices":[{"label":"Work","value":"work"},{"label":"Study","value":"study"}]}]}',
  "```",
  "",
  'Rules: ask 1 to 4 questions, each with 2 to 5 choices. "name" and every "value" are short ASCII ids. Set "multiple" to true only when several answers can apply. Keep titles short. Ask only when you truly cannot give a useful answer without the missing detail; otherwise state your assumption and answer. Never ask when the request is already clear. After the user answers, continue and give the final answer without asking again unless something essential is still missing.',
].join("\n")

export function detectQuestions(content: string): Detected {
  if (!content.includes(FENCE_START)) return { status: "none" }
  const match = FENCE.exec(content)
  if (!match) {
    return { status: "open", text: content.slice(0, content.indexOf(FENCE_START)).trim() }
  }
  const text = (
    content.slice(0, match.index) + content.slice(match.index + match[0].length)
  ).trim()
  const questions = normalize(match[1])
  if (!questions) return { status: "broken", text }
  return { status: "ready", questions, text }
}

type RawChoice = { label?: unknown; value?: unknown; description?: unknown }
type RawQuestion = {
  name?: unknown
  title?: unknown
  description?: unknown
  multiple?: unknown
  required?: unknown
  allowOther?: unknown
  choices?: unknown
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

function uniqueId(base: string, seen: Set<string>) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
  let id = clean || "item"
  let n = 2
  while (seen.has(id)) id = `${clean || "item"}-${n++}`
  seen.add(id)
  return id
}

/** Small models often leave an extra or missing bracket; this takes the first complete value. */
function parseLenient(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    // Try to repair it below.
  }
  const start = raw.search(/[[{]/)
  if (start < 0) return null
  const closers: string[] = []
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === "{") closers.push("}")
    else if (ch === "[") closers.push("]")
    else if (ch === "}" || ch === "]") {
      closers.pop()
      if (closers.length === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  if (inString) return null
  try {
    return JSON.parse(raw.slice(start) + closers.reverse().join(""))
  } catch {
    return null
  }
}

function normalize(raw: string): QuestionSpec[] | null {
  const data = parseLenient(raw)
  if (data === null) return null
  const list = Array.isArray(data)
    ? data
    : (data as { questions?: unknown } | null)?.questions
  if (!Array.isArray(list)) return null

  const names = new Set<string>()
  const out: QuestionSpec[] = []

  list.slice(0, 5).forEach((item, index) => {
    const q = (item ?? {}) as RawQuestion
    const title = str(q.title)
    if (!title) return

    const values = new Set<string>()
    const choices: QuestionChoice[] = []
    const rawChoices = Array.isArray(q.choices) ? q.choices : []
    for (const entry of rawChoices.slice(0, 6)) {
      const choice = (typeof entry === "string" ? { label: entry } : entry ?? {}) as RawChoice
      const label = str(choice.label) ?? str(choice.value)
      if (!label) continue
      choices.push({
        label,
        value: uniqueId(str(choice.value) ?? label, values),
        description: str(choice.description),
      })
    }

    const allowOther = q.allowOther === true || choices.length === 0
    out.push({
      name: uniqueId(str(q.name) ?? `q${index + 1}`, names),
      title,
      description: str(q.description),
      multiple: q.multiple === true,
      required: q.required === true,
      choices,
      input: allowOther
        ? { label: "Other answer", placeholder: "Type another answer…" }
        : undefined,
    })
  })

  return out.length ? out : null
}
