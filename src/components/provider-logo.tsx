import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { iconUrl, modelSlug, providerSlug } from "@/lib/logos"
import type { Provider } from "@/lib/providers"
import { cn } from "@/lib/utils"

/**
 * Coloured logo when one exists, mono (inverted in dark mode) when it
 * doesn't, initials when neither loads.
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
  const [failedColor, setFailedColor] = React.useState<string | null>(null)
  const mono = slug !== null && failedColor === slug

  return (
    <Avatar className={className}>
      {slug ? (
        <AvatarImage
          key={`${slug}-${mono ? "mono" : "color"}`}
          src={iconUrl(slug, !mono)}
          alt=""
          className={cn("p-1", mono && "dark:invert")}
          onLoadingStatusChange={(status) => {
            if (status === "error" && !mono) setFailedColor(slug)
          }}
        />
      ) : null}
      <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
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
