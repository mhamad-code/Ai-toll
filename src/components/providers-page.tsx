import * as React from "react"
import { KeyRound, Trash2 } from "lucide-react"

import { ProviderLogo } from "@/components/provider-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
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
import { Label } from "@/components/ui/label"
import { PROVIDERS, type Provider } from "@/lib/providers"
import { settings, useSettings } from "@/lib/store"

function ProviderCard({ provider }: { provider: Provider }) {
  const { keys } = useSettings()
  const savedKey = keys[provider.id]
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setValue(savedKey ?? "")
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    settings.setKey(provider.id, trimmed)
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <ProviderLogo provider={provider} className="mb-2 size-10" />
        <CardTitle>{provider.name}</CardTitle>
        <CardDescription>{provider.description}</CardDescription>
        <CardAction>
          <Badge variant={savedKey ? "default" : "outline"}>
            {savedKey ? "Connected" : "No key"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="gap-2">
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={
              <Button variant="outline">
                <KeyRound />
                {savedKey ? "Edit key" : "Add key"}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-sm">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{provider.name} API key</DialogTitle>
                <DialogDescription>
                  The key stays in this browser. Create one at{" "}
                  <a
                    href={provider.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {new URL(provider.keyUrl).host}
                  </a>
                  .
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <Label htmlFor={`key-${provider.id}`}>API key</Label>
                  <Input
                    id={`key-${provider.id}`}
                    name="apiKey"
                    type="password"
                    autoComplete="off"
                    placeholder={provider.placeholder}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
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
                <Button type="submit" disabled={!value.trim()}>
                  Save key
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {savedKey ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${provider.name} key`}
            onClick={() => settings.removeKey(provider.id)}
          >
            <Trash2 />
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}

export function ProvidersPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {PROVIDERS.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  )
}
