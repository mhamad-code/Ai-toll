import * as React from "react"
import { Boxes, KeyRound, Menu, MessageSquarePlus } from "lucide-react"

import { Chat } from "@/components/chat"
import { ModelsPage } from "@/components/models-page"
import { ProvidersPage } from "@/components/providers-page"
import { Button } from "@/components/ui/button"
import { ChatNavbar } from "@/components/ui/chat-navbar"
import {
  ChatSidebar,
  SideIconBtn,
  SideRow,
  SidebarCollapsibleSection,
} from "@/components/ui/chat-sidebar"
import { ModelPicker, type ModelOption } from "@/components/ui/model-picker"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { PROVIDERS } from "@/lib/providers"
import { modelKey, settings, useSettings } from "@/lib/store"

type Page = "chat" | "providers" | "models"
type Conv = { id: string; title: string }

function useIsMobile() {
  const query = "(max-width: 767px)"
  const [mobile, setMobile] = React.useState(
    () => window.matchMedia(query).matches
  )
  React.useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMobile(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return mobile
}

export default function App() {
  const mobile = useIsMobile()
  const { saved, active } = useSettings()
  const [page, setPage] = React.useState<Page>("chat")
  const [collapsed, setCollapsed] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [sectionOpen, setSectionOpen] = React.useState(true)
  const [convs, setConvs] = React.useState<Conv[]>(() => [
    { id: crypto.randomUUID(), title: "New chat" },
  ])
  const [activeId, setActiveId] = React.useState(() => convs[0].id)

  const activeConv = convs.find((c) => c.id === activeId)

  const go = (next: Page) => {
    setPage(next)
    setOpen(false)
  }
  const select = (id: string) => {
    setActiveId(id)
    go("chat")
  }
  const newChat = () => {
    const conv = { id: crypto.randomUUID(), title: "New chat" }
    setConvs((prev) => [conv, ...prev])
    select(conv.id)
  }

  const options: ModelOption[] = saved.map((m) => ({
    id: modelKey(m.provider, m.id),
    name: m.name,
    group: m.provider,
  }))
  const groups = PROVIDERS.filter((p) =>
    saved.some((m) => m.provider === p.id)
  ).map((p) => ({ id: p.id, label: p.name }))

  const pageClass = (p: Page) =>
    p === page ? "bg-sidebar-accent" : undefined

  const sidebar = (
    <ChatSidebar
      collapsed={mobile ? false : collapsed}
      onCollapsedChange={(c) => (mobile ? setOpen(false) : setCollapsed(c))}
      width={mobile ? "100%" : undefined}
      brand={<span className="px-1 text-sm font-semibold">Ai Tool</span>}
      nav={
        <>
          <SideRow
            icon={<MessageSquarePlus className="size-4" />}
            onClick={newChat}
          >
            New chat
          </SideRow>
          <SideRow
            icon={<KeyRound className="size-4" />}
            className={pageClass("providers")}
            onClick={() => go("providers")}
          >
            Providers
          </SideRow>
          <SideRow
            icon={<Boxes className="size-4" />}
            className={pageClass("models")}
            onClick={() => go("models")}
          >
            Models
          </SideRow>
        </>
      }
      rail={
        <>
          <SideIconBtn label="New chat" onClick={newChat}>
            <MessageSquarePlus className="size-4" />
          </SideIconBtn>
          <SideIconBtn label="Providers" onClick={() => go("providers")}>
            <KeyRound className="size-4" />
          </SideIconBtn>
          <SideIconBtn label="Models" onClick={() => go("models")}>
            <Boxes className="size-4" />
          </SideIconBtn>
        </>
      }
    >
      <SidebarCollapsibleSection
        title="Chats"
        open={sectionOpen}
        onToggle={() => setSectionOpen((v) => !v)}
        count={convs.length}
      >
        {convs.map((c) => (
          <SideRow
            key={c.id}
            className={
              page === "chat" && c.id === activeId
                ? "bg-sidebar-accent"
                : undefined
            }
            onClick={() => select(c.id)}
          >
            {c.title}
          </SideRow>
        ))}
      </SidebarCollapsibleSection>
    </ChatSidebar>
  )

  const title =
    page === "providers"
      ? "Providers"
      : page === "models"
        ? "Models"
        : activeConv?.title

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {mobile ? (
        open ? (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-40 w-[85%] max-w-[320px]">
              {sidebar}
            </div>
          </>
        ) : null
      ) : (
        sidebar
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatNavbar
          title={title}
          left={
            mobile ? (
              <SideIconBtn label="Open sidebar" onClick={() => setOpen(true)}>
                <Menu className="size-4" />
              </SideIconBtn>
            ) : undefined
          }
          right={
            <>
              {page === "chat" ? (
                saved.length ? (
                  <ModelPicker
                    options={options}
                    groups={groups}
                    value={active ?? undefined}
                    onChange={settings.setActive}
                    efforts={false}
                    side="bottom"
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => go("models")}
                  >
                    Add models
                  </Button>
                )
              ) : null}
              <ThemeToggle floating={false} />
            </>
          }
        />

        {/* Chat stays mounted so switching pages doesn't lose the conversation. */}
        <div className={page === "chat" ? "min-h-0 flex-1" : "hidden"}>
          <Chat key={activeId} />
        </div>
        {page === "providers" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProvidersPage />
          </div>
        ) : null}
        {page === "models" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ModelsPage onOpenProviders={() => go("providers")} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
