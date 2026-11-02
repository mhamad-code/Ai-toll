import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Provider } from "@/lib/providers"

/** Logos come from models.dev and use currentColor, so they are inverted in dark mode. */
export function ProviderLogo({
  provider,
  className,
}: {
  provider: Provider
  className?: string
}) {
  return (
    <Avatar className={className}>
      <AvatarImage
        src={`https://models.dev/logos/${provider.id}.svg`}
        alt=""
        className="p-1.5 dark:invert"
      />
      <AvatarFallback>{provider.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
