export type RuntimeTool = {
  /** Name the model sees. */
  name: string
  label: string
  connectorId: string
  connectorName: string
  description: string
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>
  /** Changes something: the user is asked before it runs. */
  write: boolean
  run: (args: Record<string, unknown>) => Promise<string>
}

export function schema(
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> {
  return { type: "object", properties, required }
}

export function str(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  return value === undefined || value === null ? "" : String(value)
}

export function need(args: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (!str(args, key)) throw new Error(`Missing argument: ${key}`)
  }
}

export function asJson(value: unknown, limit = 12000): string {
  const text = JSON.stringify(value, null, 1) ?? "null"
  return text.length > limit ? `${text.slice(0, limit)}\n…(truncated)` : text
}
