import * as React from "react"

import { onScopeChange, readItem, writeItem } from "@/lib/scope"

export type SavedModel = {
  provider: string
  id: string
  name: string
  /** Whether the model can show its thinking (used to opt in where needed). */
  reasoning?: boolean
  vision?: boolean
  /** Whether the model can call tools (connectors). */
  tools?: boolean
}

type Settings = {
  /** API keys by provider id. They never leave this browser. */
  keys: Record<string, string>
  /** Models the user added; they show up in the chat model picker. */
  saved: SavedModel[]
  /** `provider::model` key of the model chat should use. */
  active: string | null
  /** Let OpenRouter models search the web. */
  webSearch: boolean
}

export const modelKey = (provider: string, id: string) => `${provider}::${id}`

function load(): Settings {
  const empty: Settings = { keys: {}, saved: [], active: null, webSearch: false }
  try {
    const raw = readItem("settings")
    if (raw) return { ...empty, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // Unreadable storage: start empty.
  }
  return empty
}

let state: Settings = load()
onScopeChange(() => {
  state = load()
})
const listeners = new Set<() => void>()

function commit(next: Settings) {
  state = next
  try {
    writeItem("settings", JSON.stringify(next))
  } catch {
    // Storage full or blocked: keep working in memory.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSettings() {
  return React.useSyncExternalStore(subscribe, () => state)
}

export const settings = {
  setKey(provider: string, key: string) {
    commit({ ...state, keys: { ...state.keys, [provider]: key } })
  },

  removeKey(provider: string) {
    const keys = { ...state.keys }
    delete keys[provider]
    const saved = state.saved.filter((m) => m.provider !== provider)
    const stillValid = state.active && !state.active.startsWith(`${provider}::`)
    const active = stillValid
      ? state.active
      : saved[0]
        ? modelKey(saved[0].provider, saved[0].id)
        : null
    commit({ ...state, keys, saved, active })
  },

  toggleSaved(model: SavedModel) {
    const key = modelKey(model.provider, model.id)
    const exists = state.saved.some(
      (m) => modelKey(m.provider, m.id) === key
    )
    if (exists) {
      const saved = state.saved.filter(
        (m) => modelKey(m.provider, m.id) !== key
      )
      const active =
        state.active === key
          ? saved[0]
            ? modelKey(saved[0].provider, saved[0].id)
            : null
          : state.active
      commit({ ...state, saved, active })
    } else {
      commit({
        ...state,
        saved: [...state.saved, model],
        active: state.active ?? key,
      })
    }
  },

  setWebSearch(value: boolean) {
    commit({ ...state, webSearch: value })
  },

  setActive(key: string) {
    commit({ ...state, active: key })
  },
}
