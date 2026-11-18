import * as React from "react"

/**
 * The Meadow theme is the dark theme plus a `meadow` class on <html> that adds
 * the background picture and its colours. It is a device preference, kept
 * outside the per-account storage on purpose. It is the default: only an
 * explicit choice of Light or Dark turns it off.
 */
const KEY = "ui-scene"

function read() {
  try {
    return localStorage.getItem(KEY) !== "off"
  } catch {
    return false
  }
}

let meadow = read()
const listeners = new Set<() => void>()

function apply() {
  document.documentElement.classList.toggle("meadow", meadow)
}
apply()

export function setMeadow(on: boolean) {
  meadow = on
  try {
    localStorage.setItem(KEY, on ? "meadow" : "off")
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  apply()
  listeners.forEach((listener) => listener())
}

export const useMeadow = () =>
  React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => meadow
  )
