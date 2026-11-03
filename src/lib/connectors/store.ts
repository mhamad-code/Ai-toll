import * as React from "react"

import type { CustomConnector } from "@/lib/connectors/catalog"

type State = {
  connected: Record<string, boolean>
  enabled: Record<string, boolean>
  custom: CustomConnector[]
}

const KEY = "ai-toll:connectors"

function load(): State {
  const empty: State = { connected: {}, enabled: {}, custom: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty, ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    // Unreadable storage: start empty.
  }
  return empty
}

let state = load()
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: keep working in memory.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getConnectorState = () => state
export const useConnectorState = () =>
  React.useSyncExternalStore(subscribe, () => state)

export const connectorActions = {
  markConnected(id: string) {
    commit({
      ...state,
      connected: { ...state.connected, [id]: true },
      enabled: { ...state.enabled, [id]: true },
    })
  },
  markDisconnected(id: string) {
    commit({
      ...state,
      connected: { ...state.connected, [id]: false },
      enabled: { ...state.enabled, [id]: false },
    })
  },
  setEnabled(id: string, value: boolean) {
    commit({ ...state, enabled: { ...state.enabled, [id]: value } })
  },
  addCustom(connector: CustomConnector) {
    commit({
      ...state,
      custom: [...state.custom.filter((c) => c.id !== connector.id), connector],
    })
  },
  removeCustom(id: string) {
    commit({ ...state, custom: state.custom.filter((c) => c.id !== id) })
  },
}

/* --------------------------------------------------------------- notices */

export type Notice = { kind: "error" | "info"; text: string } | null

let notice: Notice = null
const noticeListeners = new Set<() => void>()

export function setNotice(next: Notice) {
  notice = next
  noticeListeners.forEach((l) => l())
}

export const useNotice = () =>
  React.useSyncExternalStore(
    (listener) => {
      noticeListeners.add(listener)
      return () => {
        noticeListeners.delete(listener)
      }
    },
    () => notice
  )

/* ---------------------------------------------------------------- tokens */

type StoredToken = { token: string; exp?: number }

export function saveToken(id: string, token: string, ttlMs?: number) {
  const value: StoredToken = {
    token,
    exp: ttlMs ? Date.now() + ttlMs : undefined,
  }
  try {
    localStorage.setItem(`ai-toll:token:${id}`, JSON.stringify(value))
  } catch {
    // Storage blocked.
  }
}

export function getToken(id: string): { token: string | null; expired: boolean } {
  try {
    const raw = localStorage.getItem(`ai-toll:token:${id}`)
    if (!raw) return { token: null, expired: false }
    const value = JSON.parse(raw) as StoredToken
    return {
      token: value.token,
      expired: value.exp !== undefined && Date.now() > value.exp,
    }
  } catch {
    return { token: null, expired: false }
  }
}

export function clearToken(id: string) {
  try {
    localStorage.removeItem(`ai-toll:token:${id}`)
  } catch {
    // Storage blocked.
  }
}
