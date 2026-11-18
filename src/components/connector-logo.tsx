import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import type { Connector } from "@/lib/connectors/catalog"
import { cn } from "@/lib/utils"

/** Brand colours first; a plain black logo (inverted in dark mode) if that fails. */
function sources(icon: string) {
  return [
    { url: `https://cdn.simpleicons.org/${icon}`, mono: false },
    { url: `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${icon}.svg`, mono: true },
  ]
}

/** Shimmers while loading, initials if no source loads. */
export function ConnectorLogo({
  connector,
  className,
}: {
  connector: Connector
  className?: string
}) {
  const [index, setIndex] = React.useState(0)
  const current = connector.icon ? (sources(connector.icon)[index] ?? null) : null

  return (
    <Avatar className={className}>
      {current ? (
        <AvatarImage
          key={current.url}
          src={current.url}
          alt=""
          className={cn(
            "p-1.5",
            (current.mono || connector.darkInvert) && "dark:invert"
          )}
          onLoadingStatusChange={(status) => {
            if (status === "error") setIndex((i) => i + 1)
          }}
        />
      ) : null}
      <AvatarFallback>
        {current ? (
          <Skeleton className="size-full rounded-full" />
        ) : (
          connector.name.slice(0, 2).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  )
}
