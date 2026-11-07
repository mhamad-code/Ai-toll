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

function ImageCard({
  title,
  description,
  image,
  href,
}: {
  title: string
  description: string
  image: string
  href?: string
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium text-foreground">{title}</span>
        {description ? (
          <span className="text-sm text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <img
        src={image}
        alt=""
        loading="lazy"
        className="h-16 w-24 shrink-0 rounded-lg object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
    </>
  )
  const className =
    "my-2 flex items-center gap-3 rounded-xl border bg-card p-3 no-underline shadow-xs transition-shadow hover:shadow-md dark:hover:shadow-white/10"

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <span className={className}>{body}</span>
  )
}

/** `[[card: Title | description | image-host/path | link-host/path]]`: a row with a picture. */
const cardHandler: PatternHandler = {
  pattern:
    /\[\[card:\s*([^|\]]+?)\s*\|\s*([^|\]]*?)\s*\|\s*([^\s|\]]+)(?:\s*\|\s*([^\s|\]]+))?\s*\]\]/g,
  render: (match) => (
    <ImageCard
      title={match[1]}
      description={match[2]}
      image={withScheme(match[3])}
      href={match[4] ? withScheme(match[4]) : undefined}
    />
  ),
}

export const richHandlers: PatternHandler[] = [...citationHandlers, cardHandler]
