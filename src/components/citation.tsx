"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import type { PatternHandler } from "@/components/ui/message"
import { decodeSource } from "@/lib/source-token"
import { topicImage, type TopicImage } from "@/lib/wiki-images"

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

/** `[[src:<hex>]]`: a source chip the app wrote itself (web search results). */
const sourceHandler: PatternHandler = {
  pattern: /\[\[src:([0-9a-f]+)\]\]/g,
  render: (match) => {
    const source = decodeSource(match[1])
    return source ? <Citation source={source} /> : null
  },
}

function ImageGallery({ topics }: { topics: string[] }) {
  const [items, setItems] = React.useState<TopicImage[] | null>(null)
  const key = topics.join("|")

  React.useEffect(() => {
    let cancelled = false
    Promise.all(topics.map(topicImage)).then((found) => {
      if (!cancelled) setItems(found.filter((x): x is TopicImage => x !== null))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (items === null) {
    return <span className="my-2 block text-xs text-muted-foreground">Loading images…</span>
  }
  if (!items.length) return null

  return (
    <span className="my-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <a
          key={item.url}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border bg-card no-underline shadow-xs transition-shadow hover:shadow-md dark:hover:shadow-white/10"
        >
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <span className="block px-2 py-1.5 text-xs font-medium text-foreground">
            {item.title}
            <span className="block font-normal text-muted-foreground">Wikipedia</span>
          </span>
        </a>
      ))}
    </span>
  )
}

/** `[[images: Topic | Another topic]]`: pictures found on Wikipedia by the app, not the model. */
const imagesHandler: PatternHandler = {
  pattern: /\[\[images:\s*([^\]]+?)\s*\]\]/g,
  render: (match) => {
    const topics = match[1]
      .split(/[|,،]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4)
    return topics.length ? <ImageGallery topics={topics} /> : null
  },
}

export const richHandlers: PatternHandler[] = [
  ...citationHandlers,
  sourceHandler,
  imagesHandler,
  cardHandler,
]
