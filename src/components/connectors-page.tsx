"use client"

import * as React from "react"
import { LoaderCircle, Plus, Search, Trash2 } from "lucide-react"

import { ConnectorLogo } from "@/components/connector-logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CATEGORIES,
  allConnectors,
  customToConnector,
  isAvailable,
  type Connector,
} from "@/lib/connectors/catalog"
import { connectConnector, disconnectConnector } from "@/lib/connectors/runtime"
import {
  connectorActions,
  getToken,
  setNotice,
  useConnectorState,
  useNotice,
} from "@/lib/connectors/store"
import { HOVER_SHADOW } from "@/lib/ui"

type Tab = "all" | "connected"

const PAGE_SIZE = 30

function AddCustom({ onAdd }: { onAdd: (c: Connector) => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")

  const valid = name.trim() !== "" && /^https:\/\/\S+$/.test(url.trim())

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const custom = { id: `custom-${slug}`, name: name.trim(), url: url.trim() }
    connectorActions.addCustom(custom)
    setOpen(false)
    setName("")
    setUrl("")
    onAdd(customToConnector(custom))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className={HOVER_SHADOW}>
            <Plus />
            Add custom
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Custom connector</DialogTitle>
            <DialogDescription>
              Paste the address of a remote MCP server. You'll sign in on its
              own page, no key needed.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="custom-name">Name</Label>
              <Input
                id="custom-name"
                placeholder="My server"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="custom-url">Server address</Label>
              <Input
                id="custom-url"
                placeholder="https://example.com/mcp"
                autoComplete="off"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={!valid}>
              Add and connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConnectorRow({
  connector,
  connected,
  busy,
  onConnect,
}: {
  connector: Connector
  connected: boolean
  busy: boolean
  onConnect: (c: Connector) => void
}) {
  const expired =
    connected &&
    connector.native &&
    connector.native !== "github" &&
    getToken(connector.native).expired
  const available = isAvailable(connector)

  return (
    <Item variant="outline" className={HOVER_SHADOW}>
      <ItemMedia>
        <ConnectorLogo connector={connector} className="size-9" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{connector.name}</ItemTitle>
        <ItemDescription>{connector.description}</ItemDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline">{connector.category}</Badge>
          {connected ? <Badge>{expired ? "Expired" : "Connected"}</Badge> : null}
          {!available ? <Badge variant="secondary">Soon</Badge> : null}
        </div>
      </ItemContent>
      <ItemActions>
        {connected && !expired ? (
          <Button
            size="sm"
            variant="outline"
            className={HOVER_SHADOW}
            onClick={() => void disconnectConnector(connector)}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            variant={available ? "default" : "secondary"}
            className={HOVER_SHADOW}
            disabled={!available || busy}
            onClick={() => onConnect(connector)}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            <span key={expired ? "re" : "c"}>{expired ? "Reconnect" : "Connect"}</span>
          </Button>
        )}
        {connector.custom ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${connector.name}`}
            onClick={() => {
              void disconnectConnector(connector)
              connectorActions.removeCustom(connector.id)
            }}
          >
            <Trash2 />
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  )
}

export function ConnectorsPage() {
  const state = useConnectorState()
  const notice = useNotice()
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [tab, setTab] = React.useState<Tab>("all")
  const [limit, setLimit] = React.useState(PAGE_SIZE)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const all = React.useMemo(() => allConnectors(state.custom), [state.custom])
  const connectedCount = all.filter((c) => state.connected[c.id]).length

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((c) => {
      if (tab === "connected" && !state.connected[c.id]) return false
      if (category !== "all" && c.category !== category) return false
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      )
    })
  }, [all, query, category, tab, state.connected])

  const visible = filtered.slice(0, limit)

  async function connect(connector: Connector) {
    setBusyId(connector.id)
    try {
      await connectConnector(connector)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Connectors</CardTitle>
          <CardDescription>
            Connect your services so the model can look things up and, with
            your approval, make changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {notice ? (
            <Alert variant={notice.kind === "error" ? "destructive" : "default"}>
              <AlertDescription className="flex items-start justify-between gap-2">
                <span>{notice.text}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setNotice(null)}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <InputGroup>
            <InputGroupInput
              placeholder="Search connectors"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>

          <Select
            value={category}
            items={[
              { label: "All categories", value: "all" },
              ...(state.custom.length ? [{ label: "Custom", value: "Custom" }] : []),
              ...CATEGORIES.map((c) => ({ label: c, value: c })),
            ]}
            onValueChange={(value) => {
              if (!value) return
              setCategory(value)
              setLimit(PAGE_SIZE)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {state.custom.length ? (
                <SelectItem value="Custom">Custom</SelectItem>
              ) : null}
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Tabs
              className="flex-1"
              value={tab}
              onValueChange={(value) => {
                setTab(value as Tab)
                setLimit(PAGE_SIZE)
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="all">
                  All <span key={all.length} translate="no">{all.length}</span>
                </TabsTrigger>
                <TabsTrigger value="connected">
                  Connected{" "}
                  <span key={connectedCount} translate="no">{connectedCount}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <AddCustom onAdd={(c) => void connect(c)} />
          </div>

          {filtered.length ? (
            <ItemGroup className="gap-2">
              {visible.map((connector) => (
                <ConnectorRow
                  key={connector.id}
                  connector={connector}
                  connected={Boolean(state.connected[connector.id])}
                  busy={busyId === connector.id}
                  onConnect={(c) => void connect(c)}
                />
              ))}
            </ItemGroup>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No connectors match this search.
            </p>
          )}

          {filtered.length > visible.length ? (
            <Button
              variant="outline"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
            >
              Show more ({filtered.length - visible.length} left)
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
