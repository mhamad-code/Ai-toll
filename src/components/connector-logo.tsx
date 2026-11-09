import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import type { Connector } from "@/lib/connectors/catalog"
import { cn } from "@/lib/utils"

/** The brand's own colours; shimmers while loading, initials if it can't load. */
export function ConnectorLogo({
  connector,
  className,
}: {
  connector: Connector
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const url =
    connector.icon && !failed
      ? `https://cdn.simpleicons.org/${connector.icon}`
      : null

  return (
    <Avatar className={className}>
      {url ? (
        <AvatarImage
          src={url}
          alt=""
          className={cn("p-1.5", connector.darkInvert && "dark:invert")}
          onLoadingStatusChange={(status) => {
            if (status === "error") setFailed(true)
          }}
        />
      ) : null}
      <AvatarFallback>
        {url ? (
          <Skeleton className="size-full rounded-full" />
        ) : (
          connector.name.slice(0, 2).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  )
}
