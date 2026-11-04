import * as React from "react"

import { onScopeChange } from "@/lib/scope"

export type ApprovalRequest = {
  title: string
  description: string
  args: Record<string, unknown>
}

type Pending = ApprovalRequest & { resolve: (allowed: boolean) => void }

const queue: Pending[] = []
let current: Pending | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function next() {
  current = queue.shift() ?? null
  emit()
}

/** Asks the user before a tool changes something. Resolves true when allowed. */
export function requestApproval(request: ApprovalRequest): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ ...request, resolve })
    if (!current) next()
  })
}

// Another user is signing in: refuse whatever the previous one left waiting.
onScopeChange(() => {
  current?.resolve(false)
  queue.splice(0).forEach((p) => p.resolve(false))
  current = null
})

export function answerApproval(allowed: boolean) {
  const done = current
  current = null
  done?.resolve(allowed)
  next()
}

export const usePendingApproval = () =>
  React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => current
  )
