import type { ChatMessageData } from "@/components/ui/message-list"
import type { QuestionSpec } from "@/lib/clarify"
import { chatDbName } from "@/lib/scope"

/** A conversation as saved on this device (IndexedDB, one database per user). */
export type StoredConv = {
  id: string
  title: string
  messages: ChatMessageData[]
  questions: Record<string, QuestionSpec[]>
  raw: Record<string, string>
  updatedAt: number
}

const STORE = "convs"

function open(scope: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(chatDbName(scope), 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(
  scope: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await open(scope)
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = action(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export const loadConvs = (scope: string) =>
  run<StoredConv[]>(scope, "readonly", (s) => s.getAll())

export const saveConv = (scope: string, conv: StoredConv) =>
  run(scope, "readwrite", (s) => s.put(conv))

export const deleteConv = (scope: string, id: string) =>
  run(scope, "readwrite", (s) => s.delete(id))

export function deleteChatDb(scope: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(chatDbName(scope))
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}
