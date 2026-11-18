import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { iconSources, modelSlug, providerSlug } from "@/lib/logos"
import type { Provider } from "@/lib/providers"
import { cn } from "@/lib/utils"

/**
 * Shimmering placeholder while the logo loads, then the coloured logo. If a
 * source fails the next one is tried; mono logos are inverted in dark mode and
 * initials show when none loads.
 */
export function BrandLogo({
  slug,
  name,
  className,
}: {
  slug: string | null
  name: string
  className?: string
}) {
  const [tried, setTried] = React.useState({ slug: "", index: 0 })
  const index = tried.slug === slug ? tried.index : 0
  const current = slug ? (iconSources(slug)[index] ?? null) : null

  return (
    <Avatar className={className}>
      {current ? (
        <AvatarImage
          key={current.url}
          src={current.url}
          alt=""
          className={cn("p-1", current.mono && "dark:invert")}
          onLoadingStatusChange={(status) => {
            if (status === "error" && slug) setTried({ slug, index: index + 1 })
          }}
        />
      ) : null}
      <AvatarFallback>
        {current ? (
          <Skeleton className="size-full rounded-full" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  )
}

export function ProviderLogo({
  provider,
  className,
}: {
  provider: Provider
  className?: string
}) {
  return (
    <BrandLogo
      slug={providerSlug(provider.id)}
      name={provider.name}
      className={className}
    />
  )
}

export function ModelLogo({
  providerId,
  modelId,
  name,
  className,
}: {
  providerId: string
  modelId: string
  name: string
  className?: string
}) {
  return (
    <BrandLogo
      slug={modelSlug(providerId, modelId, name)}
      name={name}
      className={className}
    />
  )
}
