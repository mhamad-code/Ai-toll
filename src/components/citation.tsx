"use client"

import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import type { PatternHandler } from "@/components/ui/message"

export type Source = {
  url: string
  title: string
  description?: string
}

function withScheme(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function Citation({ source }: { source: Source }) {
  const host = hostname(source.url)

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={10}
        closeDelay={100}
        render={
          <Button variant="secondary" size="xs">
            {host}
          </Button>
        }
      />
      <HoverCardContent className="flex w-64 flex-col gap-1">
        <div className="font-medium">{source.title}</div>
        {source.description ? (
          <p className="text-muted-foreground">{source.description}</p>
        ) : null}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {host}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * The model writes `[[cite: Title | host/path | description]]`; this turns it
 * into a citation chip. The address has no scheme so Markdown doesn't link it.
 */
export const citationHandlers: PatternHandler[] = [
  {
    pattern: /\[\[cite:\s*([^|\]]+?)\s*\|\s*([^\s|\]]+)(?:\s*\|\s*([^\]]*?))?\s*\]\]/g,
    render: (match) => (
      <Citation
        source={{
          title: match[1],
          url: withScheme(match[2]),
          description: match[3] || undefined,
        }}
      />
    ),
  },
]
