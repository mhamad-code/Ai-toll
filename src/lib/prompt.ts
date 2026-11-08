import { SYSTEM_PROMPT as CLARIFY_PROMPT } from "@/lib/clarify"
import { VIEW_SPEC_PROMPT } from "@/lib/generative-view"

const CITATIONS = [
  "",
  "When you rely on a web page, repository or document, cite it inline right after the claim with [[cite: Short title | host/path | short description]]. Write the address without https:// and without www. Put no links, no Markdown and no brackets inside it. Only cite addresses you actually know. Never invent one.",
].join("\n")

const RICH = [
  "",
  "Write replies like a well-designed article, not a wall of text: a short intro, headings for each part, short paragraphs, bullet lists, a table for comparisons, bold for key terms.",
  "Pictures: when a picture would help (a place, person, animal, product, landmark, concept), end your reply with one line [[images: Topic one | Topic two]] listing 1 to 4 Wikipedia article titles in English, for example [[images: Eiffel Tower | Paris]]. The app finds the pictures on Wikipedia itself. Never write image links yourself.",
  "Flows, architectures and relationships: draw them as a mermaid flowchart and colour the nodes with soft pastel fills and dark text, e.g. classDef a fill:#e0e7ff,stroke:#a5b4fc,color:#1e1b4b and classDef b fill:#dcfce7,stroke:#86efac,color:#14532d.",
  VIEW_SPEC_PROMPT,
  "To ask the user clarifying questions, use the questions block described above, not a form.",
].join("\n")

const TOOLS = [
  "",
  "You can use tools from the user's connected services. Use them when they help, and prefer read-only tools first. Before anything that creates, changes, sends or deletes, say in one line what you are about to do: the user will be asked to approve it. If a tool fails, say so plainly and explain what the user can do.",
  "For a GitHub repository, https://opengraph.githubassets.com/1/OWNER/REPO is its preview picture: show it with Markdown ![caption](address). Pictures inside a README live at https://raw.githubusercontent.com/OWNER/REPO/BRANCH/PATH.",
].join("\n")

export function buildSystemPrompt(hasTools: boolean) {
  return CLARIFY_PROMPT + CITATIONS + RICH + (hasTools ? TOOLS : "")
}
