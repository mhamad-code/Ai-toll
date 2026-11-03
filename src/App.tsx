import * as React from "react"
import {
  Boxes,
  KeyRound,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  Plug,
  UserRound,
} from "lucide-react"

import { AccountPage } from "@/components/account-page"
import { ApprovalDialog } from "@/components/approval-dialog"
import { AuthPage } from "@/components/auth-page"
import { Chat } from "@/components/chat"
import { citationHandlers } from "@/components/citation"
import { ConnectorsMenu } from "@/components/connectors-menu"
import { ConnectorsPage } from "@/components/connectors-page"
import { ModelsPage } from "@/components/models-page"
import { ModelLogo, ProviderLogo } from "@/components/provider-logo"
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
import { isFirebaseConfigured, useAuth } from "@/lib/auth"
import { handleOAuthReturn } from "@/lib/connectors/runtime"
import { PROVIDERS } from "@/lib/providers"
import { modelKey, settings, useSettings } from "@/lib/store"
import { useChats } from "@/lib/use-chats"

type Page = "chat" | "providers" | "models" | "connectors" | "account"

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
  const { keys, saved, active } = useSettings()
  const { convs, activeId, setActiveId, newChat, send, stop } = useChats()
  const { user, loading } = useAuth()

  const [page, setPage] = React.useState<Page>("chat")
  const [collapsed, setCollapsed] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [sectionOpen, setSectionOpen] = React.useState(true)

  React.useEffect(() => {
    void handleOAuthReturn().then((handled) => {
      if (handled) setPage("connectors")
    })
  }, [])

  const activeConv = convs.find((c) => c.id === activeId) ?? convs[0]
  const activeModel = saved.find((m) => modelKey(m.provider, m.id) === active)
  const apiKey = activeModel ? keys[activeModel.provider] : undefined
  const lastMessage = activeConv.messages[activeConv.messages.length - 1]
  const pendingQuestions =
    !activeConv.generating && lastMessage && activeConv.questions[lastMessage.id]
      ? { id: lastMessage.id, items: activeConv.questions[lastMessage.id] }
      : null

  const go = (next: Page) => {
    setPage(next)
    setOpen(false)
  }
  const select = (id: string) => {
    setActiveId(id)
    go("chat")
  }
  const startChat = () => {
    newChat()
    go("chat")
  }

  const options: ModelOption[] = saved.map((m) => ({
    id: modelKey(m.provider, m.id),
    name: m.name,
    group: m.provider,
    icon: (
      <ModelLogo
        providerId={m.provider}
        modelId={m.id}
        name={m.name}
        className="size-4"
      />
    ),
  }))
  const groups = PROVIDERS.filter((p) =>
    saved.some((m) => m.provider === p.id)
  ).map((p) => ({
    id: p.id,
    label: p.name,
    icon: <ProviderLogo provider={p} className="size-4" />,
  }))

  const modelPicker = saved.length ? (
    <ModelPicker
      options={options}
      groups={groups}
      value={active ?? undefined}
      onChange={settings.setActive}
      side="top"
    />
  ) : (
    <Button variant="outline" size="sm" onClick={() => go("models")}>
      Add models
    </Button>
  )

  const picker = (
    <>
      <ConnectorsMenu onOpenPage={() => go("connectors")} />
      {modelPicker}
    </>
  )

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
            onClick={startChat}
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
          <SideRow
            icon={<Plug className="size-4" />}
            className={pageClass("connectors")}
            onClick={() => go("connectors")}
          >
            Connectors
          </SideRow>
          <SideRow
            icon={<UserRound className="size-4" />}
            className={pageClass("account")}
            onClick={() => go("account")}
          >
            Account
          </SideRow>
        </>
      }
      rail={
        <>
          <SideIconBtn label="New chat" onClick={startChat}>
            <MessageSquarePlus className="size-4" />
          </SideIconBtn>
          <SideIconBtn label="Providers" onClick={() => go("providers")}>
            <KeyRound className="size-4" />
          </SideIconBtn>
          <SideIconBtn label="Models" onClick={() => go("models")}>
            <Boxes className="size-4" />
          </SideIconBtn>
          <SideIconBtn label="Connectors" onClick={() => go("connectors")}>
            <Plug className="size-4" />
          </SideIconBtn>
          <SideIconBtn label="Account" onClick={() => go("account")}>
            <UserRound className="size-4" />
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
        : page === "connectors"
          ? "Connectors"
          : page === "account"
            ? "Account"
            : activeConv.title

  if (isFirebaseConfigured && loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    )
  }
  if (isFirebaseConfigured && !user) return <AuthPage />

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <ApprovalDialog />
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
          right={<ThemeToggle floating={false} />}
        />

        {/* Chat stays mounted so switching pages doesn't lose the draft. */}
        <div className={page === "chat" ? "min-h-0 flex-1" : "hidden"}>
          <Chat
            key={activeConv.id}
            conversationKey={activeConv.id}
            messages={activeConv.messages}
            isGenerating={activeConv.generating}
            generationStartedAt={activeConv.startedAt}
            onSend={(text) =>
              send(activeConv.id, text, { model: activeModel, apiKey })
            }
            onStop={() => stop(activeConv.id)}
            tools={picker}
            pendingQuestions={pendingQuestions}
            patternHandlers={citationHandlers}
          />
        </div>
        {page === "providers" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProvidersPage />
          </div>
        ) : null}
        {page === "connectors" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConnectorsPage />
          </div>
        ) : null}
        {page === "account" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AccountPage user={user} />
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
