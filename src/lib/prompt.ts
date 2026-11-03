import { SYSTEM_PROMPT as CLARIFY_PROMPT } from "@/lib/clarify"

const CITATIONS = [
  "",
  "When you rely on a web page, repository, document or other online source, cite it inline right after the claim with [[cite: Short title | host/path | one-line description]]. Write the address without https://. Only cite addresses you actually know, from tool results or well-known documentation. Never invent one.",
].join("\n")

const TOOLS = [
  "",
  "You can use tools from the user's connected services. Use them when they help, and prefer read-only tools first. Before anything that creates, changes, sends or deletes, say in one line what you are about to do: the user will be asked to approve it. If a tool fails, say so plainly and explain what the user can do.",
].join("\n")

export function buildSystemPrompt(hasTools: boolean) {
  return CLARIFY_PROMPT + CITATIONS + (hasTools ? TOOLS : "")
}
