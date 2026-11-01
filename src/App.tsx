import * as React from "react"
import { Menu, MessageSquarePlus } from "lucide-react"

import { Chat } from "@/components/chat"
import { ChatNavbar } from "@/components/ui/chat-navbar"
import {
  ChatSidebar,
  SideIconBtn,
  SideRow,
  SidebarCollapsibleSection,
} from "@/components/ui/chat-sidebar"
import { ModelPicker, type ModelOption } from "@/components/ui/model-picker"
import { ThemeToggle } from "@/components/ui/theme-toggle"

type Conv = { id: string; title: string }

const MODELS: ModelOption[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet" },
  { id: "google/gemini-2.5-flash", name: "Gemini Flash" },
]

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
  const [collapsed, setCollapsed] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [sectionOpen, setSectionOpen] = React.useState(true)
  const [convs, setConvs] = React.useState<Conv[]>(() => [
    { id: crypto.randomUUID(), title: "New chat" },
  ])
  const [activeId, setActiveId] = React.useState(() => convs[0].id)
  const [model, setModel] = React.useState(MODELS[0].id)

  const active = convs.find((c) => c.id === activeId)

  const select = (id: string) => {
    setActiveId(id)
    setOpen(false)
  }
  const newChat = () => {
    const conv = { id: crypto.randomUUID(), title: "New chat" }
    setConvs((prev) => [conv, ...prev])
    select(conv.id)
  }

  const sidebar = (
    <ChatSidebar
      collapsed={mobile ? false : collapsed}
      onCollapsedChange={(c) => (mobile ? setOpen(false) : setCollapsed(c))}
      width={mobile ? "100%" : undefined}
      brand={<span className="px-1 text-sm font-semibold">Ai Tool</span>}
      nav={
        <SideRow
          icon={<MessageSquarePlus className="size-4" />}
          onClick={newChat}
        >
          New chat
        </SideRow>
      }
      rail={
        <SideIconBtn label="New chat" onClick={newChat}>
          <MessageSquarePlus className="size-4" />
        </SideIconBtn>
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
            className={c.id === activeId ? "bg-sidebar-accent" : undefined}
            onClick={() => select(c.id)}
          >
            {c.title}
          </SideRow>
        ))}
      </SidebarCollapsibleSection>
    </ChatSidebar>
  )

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
          title={active?.title}
          left={
            mobile ? (
              <SideIconBtn label="Open sidebar" onClick={() => setOpen(true)}>
                <Menu className="size-4" />
              </SideIconBtn>
            ) : undefined
          }
          right={
            <>
              <ModelPicker
                options={MODELS}
                value={model}
                onChange={setModel}
                side="bottom"
              />
              <ThemeToggle floating={false} />
            </>
          }
        />
        <div className="min-h-0 flex-1">
          <Chat key={activeId} />
        </div>
      </div>
    </div>
  )
}
