import { SYSTEM_PROMPT as CLARIFY_PROMPT } from "@/lib/clarify"
import { VIEW_SPEC_PROMPT } from "@/lib/generative-view"

const CITATIONS = [
  "",
  "When you rely on a web page, repository, document or other online source, cite it inline right after the claim with [[cite: Short title | host/path | one-line description]]. Write the address without https:// and without www. Only cite addresses you actually know, from tool results or well-known documentation. Never invent one.",
].join("\n")

const RICH = [
  "",
  "Write replies like a well-designed article, not a wall of text: a short intro, headings for each part, short paragraphs, bullet lists, a table for comparisons, bold for key terms.",
  "Flows, architectures and relationships: draw them as a mermaid flowchart and colour the nodes with soft pastel fills and dark text, e.g. classDef a fill:#e0e7ff,stroke:#a5b4fc,color:#1e1b4b and classDef b fill:#dcfce7,stroke:#86efac,color:#14532d.",
  VIEW_SPEC_PROMPT,
  "To ask the user clarifying questions, use the questions block described above, not a form.",
].join("\n")

const IMAGES = [
  "",
  "Images: when a picture helps (a project, place, person, animal, product, concept), get real ones with the web_find_images or web_wikipedia tools and show them with Markdown ![short caption](https://...). Use only image addresses that a tool returned, never invent or guess one. For a GitHub repository, https://opengraph.githubassets.com/1/OWNER/REPO is its preview picture.",
  "For a list of features, products, places or steps that have pictures, write one row per item as [[card: Title | one-line description | image-host/path | optional link host/path]], addresses without https:// and without www.",
].join("\n")

const TOOLS = [
  "",
  "You can use tools, including the user's connected services. Use them when they help, and prefer read-only tools first. Before anything that creates, changes, sends or deletes, say in one line what you are about to do: the user will be asked to approve it. If a tool fails, say so plainly and explain what the user can do.",
].join("\n")

export function buildSystemPrompt(hasTools: boolean) {
  return CLARIFY_PROMPT + CITATIONS + RICH + (hasTools ? IMAGES + TOOLS : "")
}
