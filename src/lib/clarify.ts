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
  | { status: "open" }
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
  'Rules: ask 1 to 4 questions, each with 2 to 5 choices. "name" and every "value" are short ASCII ids. Set "multiple" to true only when several answers can apply. Keep titles short. Never ask when the request is already clear: just answer it. After the user answers, continue and give the final answer without asking again unless something essential is still missing.',
].join("\n")

export function detectQuestions(content: string): Detected {
  if (!content.includes(FENCE_START)) return { status: "none" }
  const match = FENCE.exec(content)
  if (!match) return { status: "open" }
  const questions = normalize(match[1])
  if (!questions) return { status: "none" }
  const text = (
    content.slice(0, match.index) + content.slice(match.index + match[0].length)
  ).trim()
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

function normalize(raw: string): QuestionSpec[] | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
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
