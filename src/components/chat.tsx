"use client"

import * as React from "react"

import { ChatInput } from "@/components/ui/chat-input"
import {
  MessageList,
  type ChatMessageData,
} from "@/components/ui/message-list"
import {
  PromptSuggestions,
  type PromptSuggestion,
} from "@/components/ui/prompt-suggestions"
import { runLayoutTransition } from "@/lib/layout-transition"
import { cn } from "@/lib/utils"

const DEFAULT_SUGGESTIONS: PromptSuggestion[] = [
  { id: "explain", label: "Explain a topic in simple terms" },
  { id: "email", label: "Help me write a professional email" },
  { id: "ideas", label: "Brainstorm ideas for a small app" },
]

export type ChatProps = Omit<React.ComponentProps<"div">, "onSend"> & {
  messages: ChatMessageData[]
  isGenerating?: boolean
  generationStartedAt?: number
  onSend: (text: string) => void
  onStop?: () => void
  /** Rendered next to the attach button, e.g. the model picker. */
  tools?: React.ReactNode
  /** Headline above the composer while the conversation is empty. */
  greeting?: React.ReactNode
  /** Starter prompts listed under the centered composer. `[]` hides them. */
  suggestions?: PromptSuggestion[]
  conversationKey?: string
}

/**
 * Controlled chat layout: the host owns the messages and streams into them.
 * Empty conversations open centered; the first send slides the same composer
 * to the bottom.
 */
export function Chat({
  messages,
  isGenerating = false,
  generationStartedAt,
  onSend,
  onStop,
  tools,
  greeting = "How can I help?",
  suggestions = DEFAULT_SUGGESTIONS,
  conversationKey,
  className,
  ...props
}: ChatProps) {
  const isEmpty = messages.length === 0

  const send = React.useCallback(
    (text: string) => {
      const value = text.trim()
      if (!value) return
      if (messages.length === 0) runLayoutTransition(() => onSend(value))
      else onSend(value)
    },
    [messages.length, onSend]
  )

  return (
    <div
      data-slot="chat"
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden bg-background",
        isEmpty && "justify-center",
        className
      )}
      {...props}
    >
      {isEmpty ? (
        <div
          data-slot="chat-greeting"
          className="mx-auto w-full max-w-3xl px-4 pb-5 sm:px-6"
        >
          <h2 className="text-center text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {greeting}
          </h2>
        </div>
      ) : (
        <MessageList
          messages={messages}
          isGenerating={isGenerating}
          generationStartedAt={generationStartedAt}
          conversationKey={conversationKey}
        />
      )}

      <div data-slot="chat-composer" className="w-full">
        <ChatInput
          className={cn(
            "transition-[padding] duration-300 ease-out",
            isEmpty && "pb-0 sm:pb-0"
          )}
          isGenerating={isGenerating}
          onStop={onStop}
          tools={tools}
          onSend={({ text }) => send(text)}
        />
        {isEmpty ? (
          <PromptSuggestions
            items={suggestions}
            onSelect={(item) => send(item.label)}
          />
        ) : null}
      </div>
    </div>
  )
}
