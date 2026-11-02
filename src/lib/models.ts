import type { Provider } from "@/lib/providers"

export type ModelInfo = {
  id: string
  name: string
  /** true = priced at zero, false = priced, null = price unknown. */
  free: boolean | null
  /** USD per 1M tokens. */
  inputPrice: number | null
  outputPrice: number | null
  context: number | null
  vision: boolean
  tools: boolean
  reasoning: boolean
  imageOut: boolean
}

export type ModelsResult = { models: ModelInfo[]; notice?: string }

/* ----------------------------------------------------------------------------
 * models.dev: public catalog with prices and capabilities for most providers.
 * -------------------------------------------------------------------------- */

type CatalogModel = {
  name?: string
  attachment?: boolean
  reasoning?: boolean
  tool_call?: boolean
  cost?: { input?: number; output?: number }
  limit?: { context?: number }
  modalities?: { input?: string[]; output?: string[] }
}

type Catalog = Record<string, { models?: Record<string, CatalogModel> }>

let catalogPromise: Promise<Catalog> | null = null

function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = fetch("https://models.dev/api.json").then((res) => {
      if (!res.ok) throw new Error(`models.dev returned ${res.status}`)
      return res.json() as Promise<Catalog>
    })
    catalogPromise.catch(() => {
      catalogPromise = null
    })
  }
  return catalogPromise
}

async function catalogFor(providerId: string) {
  try {
    const all = await loadCatalog()
    return all[providerId]?.models ?? {}
  } catch {
    return {} as Record<string, CatalogModel>
  }
}

function fromCatalog(id: string, m: CatalogModel | undefined): ModelInfo {
  const input = m?.modalities?.input ?? []
  const output = m?.modalities?.output ?? []
  const inputPrice =
    typeof m?.cost?.input === "number" ? m.cost.input : null
  const outputPrice =
    typeof m?.cost?.output === "number" ? m.cost.output : null
  return {
    id,
    name: m?.name ?? id,
    free:
      inputPrice === null || outputPrice === null
        ? null
        : inputPrice === 0 && outputPrice === 0,
    inputPrice,
    outputPrice,
    context: m?.limit?.context ?? null,
    vision: input.includes("image") || (!m?.modalities && !!m?.attachment),
    tools: !!m?.tool_call,
    reasoning: !!m?.reasoning,
    imageOut: output.includes("image"),
  }
}

/* ----------------------------------------------------------------------------
 * OpenRouter: its public list already carries prices and capabilities.
 * -------------------------------------------------------------------------- */

type OpenRouterModel = {
  id: string
  name?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  architecture?: { input_modalities?: string[]; output_modalities?: string[] }
  supported_parameters?: string[]
}

function perMillion(value?: string): number | null {
  if (value == null) return null
  const n = Number(value) * 1_000_000
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function fetchOpenRouter(): Promise<ModelInfo[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models")
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`)
  const json = (await res.json()) as { data?: OpenRouterModel[] }
  return (json.data ?? []).map((m) => {
    const inputPrice = perMillion(m.pricing?.prompt)
    const outputPrice = perMillion(m.pricing?.completion)
    const params = m.supported_parameters ?? []
    return {
      id: m.id,
      name: m.name ?? m.id,
      free:
        inputPrice === null || outputPrice === null
          ? null
          : inputPrice === 0 && outputPrice === 0,
      inputPrice,
      outputPrice,
      context: m.context_length ?? null,
      vision: (m.architecture?.input_modalities ?? []).includes("image"),
      tools: params.includes("tools"),
      reasoning:
        params.includes("reasoning") || params.includes("include_reasoning"),
      imageOut: (m.architecture?.output_modalities ?? []).includes("image"),
    }
  })
}

/* ----------------------------------------------------------------------------
 * Live model lists, called straight from the browser with the user's key.
 * -------------------------------------------------------------------------- */

class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

type LiveModel = { id: string; name?: string }

async function fetchLive(p: Provider, key: string): Promise<LiveModel[]> {
  if (p.kind === "google") {
    const url = `${p.baseURL}/models?pageSize=1000&key=${encodeURIComponent(key)}`
    const res = await fetch(url)
    if (!res.ok) throw new HttpError(res.status)
    const json = (await res.json()) as {
      models?: {
        name: string
        displayName?: string
        supportedGenerationMethods?: string[]
      }[]
    }
    return (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        name: m.displayName,
      }))
  }

  const headers: Record<string, string> =
    p.kind === "anthropic"
      ? {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        }
      : { Authorization: `Bearer ${key}` }
  const query = p.kind === "anthropic" ? "?limit=1000" : ""
  const res = await fetch(`${p.baseURL}/models${query}`, { headers })
  if (!res.ok) throw new HttpError(res.status)
  const json = (await res.json()) as unknown
  const list = Array.isArray(json)
    ? json
    : ((json as { data?: unknown[] }).data ?? [])
  return (list as { id: string; display_name?: string }[]).map((m) => ({
    id: m.id,
    name: m.display_name,
  }))
}

function keyRejected(p: Provider, error: unknown) {
  if (!(error instanceof HttpError)) return false
  if (error.status === 401 || error.status === 403) return true
  return p.kind === "google" && error.status === 400
}

/* ----------------------------------------------------------------------------
 * Public entry point
 * -------------------------------------------------------------------------- */

export async function fetchModels(
  p: Provider,
  key: string
): Promise<ModelsResult> {
  if (p.kind === "openrouter") {
    const models = await fetchOpenRouter()
    return { models: sortModels(models) }
  }

  const catalog = await catalogFor(p.id)
  const fromCatalogOnly = () =>
    Object.entries(catalog).map(([id, m]) => fromCatalog(id, m))

  if (!p.liveList) {
    const models = fromCatalogOnly()
    if (!models.length) throw new Error("No model catalog is available for this provider.")
    return {
      models: sortModels(models),
      notice: `${p.name} has no model-list endpoint, so this is the public catalog.`,
    }
  }

  try {
    const live = await fetchLive(p, key)
    const models = live.map((l) => {
      const known = catalog[l.id]
      const info = fromCatalog(l.id, known)
      return known ? info : { ...info, name: l.name ?? l.id }
    })
    return { models: sortModels(models) }
  } catch (error) {
    if (keyRejected(p, error)) {
      throw new Error(
        "The provider rejected this API key. Edit it on the Providers page."
      )
    }
    const models = fromCatalogOnly()
    if (!models.length) {
      throw new Error(
        "Couldn't reach the provider from the browser, and no catalog is available."
      )
    }
    return {
      models: sortModels(models),
      notice: `Couldn't reach ${p.name} directly (the browser may block it), so this is the public catalog.`,
    }
  }
}

function sortModels(models: ModelInfo[]) {
  return [...models].sort((a, b) => a.name.localeCompare(b.name))
}
