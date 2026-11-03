import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Connector } from "@/lib/connectors/catalog"
import { cn } from "@/lib/utils"

/** The brand's own colours; black logos are inverted in dark mode. */
export function ConnectorLogo({
  connector,
  className,
}: {
  connector: Connector
  className?: string
}) {
  return (
    <Avatar className={className}>
      {connector.icon ? (
        <AvatarImage
          src={`https://cdn.simpleicons.org/${connector.icon}`}
          alt=""
          className={cn("p-1.5", connector.darkInvert && "dark:invert")}
        />
      ) : null}
      <AvatarFallback>{connector.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
