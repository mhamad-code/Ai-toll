"use client"

import { Plug, Plus, SlidersHorizontal } from "lucide-react"

import { ConnectorLogo } from "@/components/connector-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import {
  allConnectors,
  isAvailable,
} from "@/lib/connectors/catalog"
import { connectConnector } from "@/lib/connectors/runtime"
import { connectorActions, useConnectorState } from "@/lib/connectors/store"

const SUGGESTED = ["github", "gmail", "gcalendar", "gdrive", "linear", "notion"]

/** The plug button in the composer: switch connectors on or off, or add more. */
export function ConnectorsMenu({ onOpenPage }: { onOpenPage: () => void }) {
  const state = useConnectorState()
  const all = allConnectors(state.custom)
  const connected = all.filter((c) => state.connected[c.id])
  const suggestions = SUGGESTED.map((id) => all.find((c) => c.id === id))
    .filter((c) => c && !state.connected[c.id] && isAvailable(c))
    .slice(0, 4)
  const active = connected.filter((c) => state.enabled[c.id]).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Connectors">
            <Plug />
            {active > 0 ? (
              <span key={active} translate="no" className="text-xs">
                {active}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent side="top" align="start" className="w-72">
        <DropdownMenuItem onClick={onOpenPage}>
          <SlidersHorizontal />
          Manage connectors
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenPage}>
          <Plus />
          Add connectors
        </DropdownMenuItem>
        {connected.length || suggestions.length ? <DropdownMenuSeparator /> : null}

        {connected.map((c) => (
          <DropdownMenuItem
            key={c.id}
            closeOnClick={false}
            onClick={() => connectorActions.setEnabled(c.id, !state.enabled[c.id])}
          >
            <ConnectorLogo connector={c} className="size-5" />
            <span className="flex-1 truncate">{c.name}</span>
            <Switch
              checked={Boolean(state.enabled[c.id])}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none"
            />
          </DropdownMenuItem>
        ))}

        {suggestions.map((c) =>
          c ? (
            <DropdownMenuItem
              key={c.id}
              onClick={() => {
                void connectConnector(c).then(onOpenPage)
              }}
            >
              <ConnectorLogo connector={c} className="size-5" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground">Connect</span>
            </DropdownMenuItem>
          ) : null
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
