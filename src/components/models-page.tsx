import * as React from "react"
import {
  Brain,
  Eye,
  ImageIcon,
  LoaderCircle,
  Search,
  Wrench,
} from "lucide-react"

import { ModelLogo, ProviderLogo } from "@/components/provider-logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchModels, type ModelInfo } from "@/lib/models"
import { PROVIDERS, type Provider } from "@/lib/providers"
import { modelKey, settings, useSettings } from "@/lib/store"
import { HOVER_SHADOW } from "@/lib/ui"

type Tab = "all" | "free" | "paid"

type Load = {
  status: "idle" | "loading" | "ready" | "error"
  models: ModelInfo[]
  notice?: string
  error?: string
}

const PAGE_SIZE = 40

const money = (n: number) =>
  n === 0 ? "0" : String(Math.round(n * (n >= 1 ? 100 : 1000)) / (n >= 1 ? 100 : 1000))

const tokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`

function ModelRow({
  model,
  provider,
  added,
}: {
  model: ModelInfo
  provider: Provider
  added: boolean
}) {
  return (
    <Item variant="outline" className={HOVER_SHADOW}>
      <ItemMedia>
        <ModelLogo
          providerId={provider.id}
          modelId={model.id}
          name={model.name}
          className="size-9"
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{model.name}</ItemTitle>
        <ItemDescription>{model.id}</ItemDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {model.free === true ? <Badge>Free</Badge> : null}
          {model.free === false &&
          model.inputPrice !== null &&
          model.outputPrice !== null ? (
            <Badge variant="outline">
              ${money(model.inputPrice)} in / ${money(model.outputPrice)} out per 1M
            </Badge>
          ) : null}
          {model.context ? (
            <Badge variant="outline">{tokens(model.context)} context</Badge>
          ) : null}
          {model.vision ? (
            <Badge variant="secondary">
              <Eye /> Vision
            </Badge>
          ) : null}
          {model.tools ? (
            <Badge variant="secondary">
              <Wrench /> Tools
            </Badge>
          ) : null}
          {model.reasoning ? (
            <Badge variant="secondary">
              <Brain /> Reasoning
            </Badge>
          ) : null}
          {model.imageOut ? (
            <Badge variant="secondary">
              <ImageIcon /> Image output
            </Badge>
          ) : null}
        </div>
      </ItemContent>
      <ItemActions>
        <Button
          size="sm"
          className={HOVER_SHADOW}
          variant={added ? "secondary" : "outline"}
          onClick={() =>
            settings.toggleSaved({
              provider: provider.id,
              id: model.id,
              name: model.name,
              reasoning: model.reasoning,
              vision: model.vision,
              tools: model.tools,
            })
          }
        >
          <span key={added ? "added" : "add"}>{added ? "Added" : "Add"}</span>
        </Button>
      </ItemActions>
    </Item>
  )
}

export function ModelsPage({ onOpenProviders }: { onOpenProviders: () => void }) {
  const { keys, saved } = useSettings()
  const connected = PROVIDERS.filter((p) => keys[p.id])
  const [pickedId, setPickedId] = React.useState<string | null>(null)
  const provider = connected.find((p) => p.id === pickedId) ?? connected[0]
  const key = provider ? keys[provider.id] : undefined

  const [load, setLoad] = React.useState<Load>({ status: "idle", models: [] })
  const [query, setQuery] = React.useState("")
  const [tab, setTab] = React.useState<Tab>("all")
  const [limit, setLimit] = React.useState(PAGE_SIZE)

  React.useEffect(() => {
    if (!provider || !key) return
    let cancelled = false
    setLoad({ status: "loading", models: [] })
    fetchModels(provider, key)
      .then((result) => {
        if (!cancelled) {
          setLoad({
            status: "ready",
            models: result.models,
            notice: result.notice,
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoad({
            status: "error",
            models: [],
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [provider, key])

  const counts = React.useMemo(
    () => ({
      all: load.models.length,
      free: load.models.filter((m) => m.free === true).length,
      paid: load.models.filter((m) => m.free !== true).length,
    }),
    [load.models]
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return load.models.filter((m) => {
      if (tab === "free" && m.free !== true) return false
      if (tab === "paid" && m.free === true) return false
      return !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    })
  }, [load.models, query, tab])

  if (!provider) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>No providers connected</CardTitle>
            <CardDescription>
              Add an API key to a provider, then come back to browse its models.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onOpenProviders}>Open providers</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const savedKeys = new Set(saved.map((m) => modelKey(m.provider, m.id)))
  const visible = filtered.slice(0, limit)

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Models</CardTitle>
          <CardDescription>
            Add the models you want in the chat model picker.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={provider} className="size-9 shrink-0" />
            <Select
              value={provider.id}
              items={connected.map((p) => ({ label: p.name, value: p.id }))}
              onValueChange={(value) => {
                if (!value) return
                setPickedId(value)
                setQuery("")
                setTab("all")
                setLimit(PAGE_SIZE)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {connected.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <InputGroup>
            <InputGroupInput
              placeholder="Search models"
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

          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as Tab)
              setLimit(PAGE_SIZE)
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="all">
                All <span key={counts.all} translate="no">{counts.all}</span>
              </TabsTrigger>
              <TabsTrigger value="free">
                Free <span key={counts.free} translate="no">{counts.free}</span>
              </TabsTrigger>
              <TabsTrigger value="paid">
                Paid <span key={counts.paid} translate="no">{counts.paid}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {load.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading models
            </div>
          ) : null}

          {load.status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn't load models</AlertTitle>
              <AlertDescription>{load.error}</AlertDescription>
            </Alert>
          ) : null}

          {load.notice ? (
            <Alert>
              <AlertTitle>Showing the public catalog</AlertTitle>
              <AlertDescription>{load.notice}</AlertDescription>
            </Alert>
          ) : null}

          {load.status === "ready" ? (
            filtered.length ? (
              <ItemGroup className="gap-2">
                {visible.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    provider={provider}
                    added={savedKeys.has(modelKey(provider.id, model.id))}
                  />
                ))}
              </ItemGroup>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No models match this search.
              </p>
            )
          ) : null}

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
