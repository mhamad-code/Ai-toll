/**
 * Brand logos from the Lobe Icons set. `{slug}-color.svg` is the coloured
 * version; `{slug}.svg` is the mono fallback.
 */
const BASE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons"

export const iconUrl = (slug: string, color: boolean) =>
  `${BASE}/${slug}${color ? "-color" : ""}.svg`

const PROVIDER_SLUGS: Record<string, string> = {
  openrouter: "openrouter",
  openai: "openai",
  anthropic: "claude",
  google: "gemini",
  mistral: "mistral",
  groq: "groq",
  deepseek: "deepseek",
  xai: "xai",
  togetherai: "together",
  cerebras: "cerebras",
  perplexity: "perplexity",
}

export const providerSlug = (providerId: string) =>
  PROVIDER_SLUGS[providerId] ?? providerId

/** Matched against "<model id> <model name>"; the first hit wins. */
const NAME_RULES: [RegExp, string][] = [
  [/claude/i, "claude"],
  [/gemma/i, "gemma"],
  [/gemini|imagen|\bveo/i, "gemini"],
  [/llama/i, "meta"],
  [/mistral|mixtral|codestral|pixtral|ministral|devstral|magistral|voxtral/i, "mistral"],
  [/deepseek/i, "deepseek"],
  [/qwen|qwq/i, "qwen"],
  [/grok/i, "grok"],
  [/command|\baya\b|cohere/i, "cohere"],
  [/sonar/i, "perplexity"],
  [/glm/i, "zhipu"],
  [/kimi|moonshot/i, "moonshot"],
  [/minimax/i, "minimax"],
  [/nemotron/i, "nvidia"],
  [/\bphi-/i, "microsoft"],
  [/gpt|chatgpt|\bo[134](-|\b)|dall-e|whisper|sora/i, "openai"],
]

/** The part before the slash in ids like `google/gemma-4`. */
const ORG_SLUGS: Record<string, string> = {
  openai: "openai",
  anthropic: "claude",
  google: "google",
  "meta-llama": "meta",
  meta: "meta",
  mistralai: "mistral",
  deepseek: "deepseek",
  qwen: "qwen",
  "x-ai": "xai",
  cohere: "cohere",
  microsoft: "microsoft",
  nvidia: "nvidia",
  moonshotai: "moonshot",
  "z-ai": "zhipu",
  minimax: "minimax",
  perplexity: "perplexity",
  amazon: "aws",
  baidu: "baidu",
  tencent: "tencent",
  bytedance: "bytedance",
  "bytedance-seed": "bytedance",
  alibaba: "alibabacloud",
  ai21: "ai21",
}

const AGGREGATORS = new Set(["openrouter", "togetherai"])

/** Logo of whoever made the model, or null when we can't tell. */
export function modelSlug(
  providerId: string,
  modelId: string,
  name?: string
): string | null {
  const text = `${modelId} ${name ?? ""}`
  for (const [pattern, slug] of NAME_RULES) {
    if (pattern.test(text)) return slug
  }
  const org = modelId.includes("/") ? modelId.split("/")[0].toLowerCase() : null
  if (org && ORG_SLUGS[org]) return ORG_SLUGS[org]
  if (AGGREGATORS.has(providerId)) return null
  return providerSlug(providerId)
}
