export type ProviderKind = "openrouter" | "openai" | "anthropic" | "google"

export type Provider = {
  /** Same id models.dev uses, so logos and the model catalog line up. */
  id: string
  name: string
  description: string
  kind: ProviderKind
  baseURL: string
  /** Does the provider expose a model-list endpoint we can call? */
  liveList: boolean
  keyUrl: string
  placeholder: string
}

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One key for hundreds of models, including free ones.",
    kind: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    liveList: true,
    keyUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-v1-...",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models, reasoning models and image generation.",
    kind: "openai",
    baseURL: "https://api.openai.com/v1",
    liveList: true,
    keyUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models with long context and tool use.",
    kind: "anthropic",
    baseURL: "https://api.anthropic.com/v1",
    liveList: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models with vision and very long context.",
    kind: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    liveList: true,
    keyUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Open and commercial models from Mistral.",
    kind: "openai",
    baseURL: "https://api.mistral.ai/v1",
    liveList: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    placeholder: "Mistral API key",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Very fast inference for open models.",
    kind: "openai",
    baseURL: "https://api.groq.com/openai/v1",
    liveList: true,
    keyUrl: "https://console.groq.com/keys",
    placeholder: "gsk_...",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Low-cost chat and reasoning models.",
    kind: "openai",
    baseURL: "https://api.deepseek.com/v1",
    liveList: true,
    keyUrl: "https://platform.deepseek.com/api_keys",
    placeholder: "sk-...",
  },
  {
    id: "xai",
    name: "xAI",
    description: "Grok models.",
    kind: "openai",
    baseURL: "https://api.x.ai/v1",
    liveList: true,
    keyUrl: "https://console.x.ai",
    placeholder: "xai-...",
  },
  {
    id: "togetherai",
    name: "Together AI",
    description: "Open-source models hosted by Together.",
    kind: "openai",
    baseURL: "https://api.together.xyz/v1",
    liveList: true,
    keyUrl: "https://api.together.ai/settings/api-keys",
    placeholder: "Together API key",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    description: "Fast inference for open models.",
    kind: "openai",
    baseURL: "https://api.cerebras.ai/v1",
    liveList: true,
    keyUrl: "https://cloud.cerebras.ai",
    placeholder: "csk-...",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    description: "Search-grounded answers with citations.",
    kind: "openai",
    baseURL: "https://api.perplexity.ai",
    liveList: false,
    keyUrl: "https://www.perplexity.ai/settings/api",
    placeholder: "pplx-...",
  },
]

export function providerById(id: string) {
  return PROVIDERS.find((p) => p.id === id)
}
