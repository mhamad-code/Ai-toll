import * as React from "react"
import {
  Boxes,
  Code2,
  KeyRound,
  Menu,
  MessageSquarePlus,
  Plug,
  Trash2,
  UserRound,
} from "lucide-react"

import { AccountPage } from "@/components/account-page"
import { ApprovalDialog } from "@/components/approval-dialog"
import { AuthPage } from "@/components/auth-page"
import { Chat } from "@/components/chat"
import CodePage from "@/components/code-page"
import { richHandlers } from "@/components/citation"
import { ConnectorsMenu } from "@/components/connectors-menu"
import { ConnectorsPage } from "@/components/connectors-page"
import { ModelsPage } from "@/components/models-page"
import { ModelLogo, ProviderLogo } from "@/components/provider-logo"
import { ProvidersPage } from "@/components/providers-page"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChatNavbar } from "@/components/ui/chat-navbar"
import {
  ChatSidebar,
  SideIconBtn,
  SideRow,
  SidebarCollapsibleSection,
} from "@/components/ui/chat-sidebar"
import { ModelPicker, type ModelOption } from "@/components/ui/model-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemePicker } from "@/components/theme-picker"
import type { User } from "firebase/auth"

import { isFirebaseConfigured, useAuth } from "@/lib/auth"
import { handleOAuthReturn } from "@/lib/connectors/runtime"
import { PROVIDERS } from "@/lib/providers"
import { navigate, useRoute, type Page } from "@/lib/router"
import { cn } from "@/lib/utils"
import { modelKey, settings, useSettings } from "@/lib/store"
import { switchScope } from "@/lib/scope"
import { useChats } from "@/lib/use-chats"

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

/** Shown while the sign-in state is being restored. */
function AppSkeleton() {
  return (
    <div className="flex h-dvh w-full bg-background" aria-busy="true">
      <div className="hidden w-72 shrink-0 flex-col gap-3 border-r p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b p-3">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <div className="p-4">
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  )
}

function AppInner({ scope, user }: { scope: string; user: User | null }) {
  const mobile = useIsMobile()
  const { keys, saved, active, webSearch } = useSettings()
  const { convs, activeId, setActiveId, newChat, send, stop, remove, loaded } =
    useChats(scope)

  // The address bar is the source of truth: /, /chat/<id>, /models, …
  const route = useRoute()
  const page = route.page
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [collapsed, setCollapsed] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [sectionOpen, setSectionOpen] = React.useState(true)

  React.useEffect(() => {
    void handleOAuthReturn().then((handled) => {
      if (handled) navigate({ page: "connectors" }, true)
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

  // /chat/<id> opens that conversation; / is always a fresh chat.
  React.useEffect(() => {
    if (route.page !== "chat") return
    if (route.id) {
      if (convs.some((c) => c.id === route.id)) {
        if (route.id !== activeId) setActiveId(route.id)
      } else if (loaded) {
        navigate({ page: "chat" }, true)
      }
    } else {
      const current = convs.find((c) => c.id === activeId)
      if (current && current.messages.length > 0) newChat()
    }
  }, [route.page, route.id, convs, activeId, loaded, setActiveId, newChat])

  const go = (next: Page) => {
    navigate(
      next === "chat"
        ? activeConv.messages.length > 0
          ? { page: "chat", id: activeConv.id }
          : { page: "chat" }
        : { page: next }
    )
    setOpen(false)
  }
  const select = (id: string) => {
    navigate({ page: "chat", id })
    setOpen(false)
  }
  const startChat = () => {
    newChat()
    navigate({ page: "chat" })
    setOpen(false)
  }
  const confirmDelete = () => {
    if (!deleteId) return
    const wasOpen = deleteId === activeConv.id
    if (wasOpen) newChat()
    remove(deleteId)
    setDeleteId(null)
    if (wasOpen || route.id === deleteId) navigate({ page: "chat" }, true)
  }
  const deleting = convs.find((c) => c.id === deleteId)

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
            icon={<Code2 className="size-4" />}
            className={pageClass("code")}
            onClick={() => go("code")}
          >
            Code
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
          <SideIconBtn label="Code" onClick={() => go("code")}>
            <Code2 className="size-4" />
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
        {convs.map((c) => {
          const isActive = page === "chat" && c.id === activeId
          return (
            <div key={c.id} className="group/chat relative">
              <SideRow
                className={cn(isActive && "bg-sidebar-accent", "pr-8")}
                onClick={() => select(c.id)}
              >
                {c.title}
              </SideRow>
              {c.messages.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete chat: ${c.title}`}
                  className={cn(
                    "absolute top-1/2 right-1 size-6 -translate-y-1/2",
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100"
                  )}
                  onClick={() => setDeleteId(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          )
        })}
        {!loaded
          ? [0, 1, 2].map((i) => (
              <Skeleton key={i} className="mx-2 my-1 h-7" />
            ))
          : null}
      </SidebarCollapsibleSection>
    </ChatSidebar>
  )

  const title =
    page === "code"
      ? "Code"
      : page === "providers"
      ? "Providers"
      : page === "models"
        ? "Models"
        : page === "connectors"
          ? "Connectors"
          : page === "account"
            ? "Account"
            : activeConv.title

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <ApprovalDialog />
      <Dialog
        open={deleteId !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              {deleting ? `"${deleting.title}" ` : ""}will be removed from this
              device. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          right={<ThemePicker />}
        />

        {/* Chat stays mounted so switching pages doesn't lose the draft. */}
        <div className={page === "chat" ? "min-h-0 flex-1" : "hidden"}>
          <Chat
            key={activeConv.id}
            conversationKey={activeConv.id}
            messages={activeConv.messages}
            isGenerating={activeConv.generating}
            generationStartedAt={activeConv.startedAt}
            onSend={(text) => {
              // The first message gives the chat its own address.
              if (!route.id) navigate({ page: "chat", id: activeConv.id }, true)
              void send(activeConv.id, text, {
                model: activeModel,
                apiKey,
                webSearch,
              })
            }}
            onStop={() => stop(activeConv.id)}
            tools={picker}
            pendingQuestions={pendingQuestions}
            patternHandlers={richHandlers}
          />
        </div>
        {page === "code" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodePage />
          </div>
        ) : null}
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

/**
 * Decides whose data the app shows. Each account has its own storage; with
 * nobody signed in nothing is readable, and `key` rebuilds the whole app when
 * the account changes so no state from the previous one survives.
 */
export default function App() {
  const { user, loading } = useAuth()

  if (isFirebaseConfigured && loading) return <AppSkeleton />
  if (isFirebaseConfigured && !user) {
    switchScope(null)
    return <AuthPage />
  }

  const scope = isFirebaseConfigured && user ? user.uid : "local"
  switchScope(scope)
  return <AppInner key={scope} scope={scope} user={user} />
}
