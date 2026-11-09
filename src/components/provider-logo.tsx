import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { iconUrl, modelSlug, providerSlug } from "@/lib/logos"
import type { Provider } from "@/lib/providers"
import { cn } from "@/lib/utils"

/**
 * Shimmering placeholder while the logo loads, then the coloured logo; mono
 * (inverted in dark mode) when there is no coloured one, initials when
 * neither loads.
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
  const [failure, setFailure] = React.useState<{
    slug: string
    phase: "mono" | "none"
  } | null>(null)
  const phase = failure && failure.slug === slug ? failure.phase : "color"
  const url = slug && phase !== "none" ? iconUrl(slug, phase === "color") : null

  return (
    <Avatar className={className}>
      {url ? (
        <AvatarImage
          key={url}
          src={url}
          alt=""
          className={cn("p-1", phase === "mono" && "dark:invert")}
          onLoadingStatusChange={(status) => {
            if (status === "error" && slug) {
              setFailure({ slug, phase: phase === "color" ? "mono" : "none" })
            }
          }}
        />
      ) : null}
      <AvatarFallback>
        {url ? (
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
