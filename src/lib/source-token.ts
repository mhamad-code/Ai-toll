export type SourceInfo = { title: string; url: string; description?: string }

/**
 * A source chip is written into the answer as `[[src:<hex>]]`. The data is
 * hex-encoded so no link, bracket or Markdown character inside a title or
 * snippet can make the Markdown renderer split the text and break the chip.
 */
export function encodeSource(source: SourceInfo): string {
  const json = JSON.stringify(source)
  return Array.from(new TextEncoder().encode(json), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")
}

export function decodeSource(hex: string): SourceInfo | null {
  try {
    const pairs = hex.match(/../g) ?? []
    const bytes = Uint8Array.from(pairs, (p) => parseInt(p, 16))
    const value = JSON.parse(new TextDecoder().decode(bytes)) as SourceInfo
    return typeof value.url === "string" && typeof value.title === "string"
      ? value
      : null
  } catch {
    return null
  }
}
