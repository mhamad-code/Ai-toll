import * as React from "react"

import "./code-activity.css"
import {
  iconKind,
  runCodeAgent,
  RUNNING,
  type ActionKind,
  type AgentBlock,
  type AgentGroup,
} from "@/lib/code/agent"
import {
  loadFiles,
  runShell,
  saveFiles,
  type ProjectFiles,
  type TerminalLine,
} from "@/lib/code/workspace"
import { modelKey, useSettings } from "@/lib/store"
import { providerById } from "@/lib/providers"

const svg = (inner: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`

const ICONS = {
  sparkle: svg('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
  plug: svg('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
  file: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
  edit: svg('<path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>'),
  terminal: svg('<path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  wave: svg('<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>'),
  send: svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  monitor: svg('<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
  folder: svg('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
}

const SUGGESTION =
  "ابنِ لي صفحة هبوط عربية لمتجر قهوة مختصة: قسم بطل، قائمة المنتجات، وآراء العملاء، ثم شغّل الاختبار وافتح المعاينة."

const ICON_FOR: Record<ActionKind, { svg: string; cls: string }> = {
  think: { svg: ICONS.sparkle, cls: "c-blue" },
  browser: { svg: ICONS.plug, cls: "c-blue" },
  read: { svg: ICONS.file, cls: "c-green" },
  edit: { svg: ICONS.edit, cls: "c-green" },
  cmd: { svg: ICONS.terminal, cls: "c-orange" },
}

type Turn = {
  id: string
  startedAt: number
  finishedAt?: number
  cancelled: boolean
  collapsed: boolean
  blocks: AgentBlock[]
}

type Entry =
  | { kind: "user"; id: string; text: string }
  | { kind: "turn"; id: string; data: Turn }

type Line = TerminalLine

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return m ? `${m}m ${r}s` : `${r}s`
}

const ACTIVITY = "code-activity"

export default function CodePage() {
  const { saved, active, keys } = useSettings()
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [running, setRunning] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [specOpen, setSpecOpen] = React.useState(false)
  const [filesOpen, setFilesOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [termOpen, setTermOpen] = React.useState(false)
  const [termLines, setTermLines] = React.useState<Line[]>([])
  const [termInput, setTermInput] = React.useState("")
  const [files, setFiles] = React.useState<ProjectFiles>(() => loadFiles())
  const [preview, setPreview] = React.useState<{ path: string; html: string } | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())
  const [atBottom, setAtBottom] = React.useState(true)
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => new Set())

  const chatRef = React.useRef<HTMLDivElement>(null)
  const followRef = React.useRef(true)
  const abortRef = React.useRef<AbortController | null>(null)
  const historyRef = React.useRef<{ role: "user" | "assistant"; content: string }[]>([])
  const textRef = React.useRef<Record<string, string>>({})
  const termRef = React.useRef<HTMLDivElement>(null)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)

  const activeModel = saved.find((m) => modelKey(m.provider, m.id) === active)
  const apiKey = activeModel ? keys[activeModel.provider] : undefined
  const provider = activeModel ? providerById(activeModel.provider) : undefined

  const scrollDown = React.useCallback((smooth = false) => {
    const chat = chatRef.current
    if (!chat) return
    chat.scrollTo({ top: chat.scrollHeight, behavior: smooth ? "smooth" : "auto" })
  }, [])

  React.useEffect(() => {
    if (followRef.current) scrollDown()
  }, [entries, scrollDown])

  React.useEffect(() => {
    const chat = chatRef.current
    if (!chat) return
    const onScroll = () => {
      const d = chat.scrollHeight - chat.scrollTop - chat.clientHeight
      followRef.current = d < 80
      setAtBottom(d < 120)
    }
    chat.addEventListener("scroll", onScroll, { passive: true })
    return () => chat.removeEventListener("scroll", onScroll)
  }, [])

  React.useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [termLines, termOpen])

  const patchTurn = React.useCallback(
    (turnId: string, update: (turn: Turn) => Turn) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.kind === "turn" && e.id === turnId ? { ...e, data: update(e.data) } : e
        )
      )
    },
    []
  )

  const pushText = React.useCallback(
    (turnId: string, text: string, final = false) => {
      patchTurn(turnId, (turn) => ({
        ...turn,
        blocks: [...turn.blocks, { kind: "text", id: crypto.randomUUID(), text, final }],
      }))
    },
    [patchTurn]
  )

  const run = React.useCallback(
    async (text: string) => {
      if (running) return
      setRunning(true)
      followRef.current = true
      textRef.current = {}

      const turnId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      setEntries((prev) => [
        ...prev,
        { kind: "user", id: userId, text },
        {
          kind: "turn",
          id: turnId,
          data: {
            id: turnId,
            startedAt: Date.now(),
            cancelled: false,
            collapsed: false,
            blocks: [],
          },
        },
      ])

      if (!provider || !activeModel || !apiKey) {
        pushText(
          turnId,
          "No model selected. Add a key on the Providers page and a model on the Models page, then come back to this Code section.",
          true
        )
        patchTurn(turnId, (t) => ({ ...t, finishedAt: Date.now() }))
        setRunning(false)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      const timer = setInterval(() => setNow(Date.now()), 500)
      let finalText = ""

      try {
        await runCodeAgent({
          provider,
          model: activeModel,
          apiKey,
          prompt: text,
          signal: controller.signal,
          reasoning: activeModel.reasoning,
          history: historyRef.current,
          sink: (event) => {
            if (event.type === "blocks") {
              patchTurn(turnId, (turn) => ({
                ...turn,
                blocks: event.blocks.map((b) =>
                  b.kind === "text" ? { ...b } : { ...b, data: { ...b.data } }
                ),
              }))
              for (const block of event.blocks) {
                if (block.kind === "text" && block.final) finalText = block.text
              }
            } else if (event.type === "files") {
              setFiles(event.files)
            } else if (event.type === "terminal") {
              setTermLines((prev) => [
                ...prev,
                { kind: "cmd", text: event.command },
                ...event.lines,
              ])
              setTermOpen(true)
            } else if (event.type === "preview") {
              setPreview({ path: event.path, html: event.html })
              setPreviewOpen(true)
            } else if (event.type === "error") {
              patchTurn(turnId, (turn) => ({
                ...turn,
                blocks: [
                  ...turn.blocks,
                  {
                    kind: "text",
                    id: crypto.randomUUID(),
                    text: `⚠️ ${event.message}`,
                    final: true,
                  },
                ],
              }))
            }
          },
        })
      } finally {
        clearInterval(timer)
        abortRef.current = null
        const cancelled = controller.signal.aborted
        patchTurn(turnId, (turn) => ({
          ...turn,
          finishedAt: Date.now(),
          cancelled,
        }))
        setRunning(false)
      }

      const turnHistory: { role: "user" | "assistant"; content: string }[] = [
        { role: "user", content: text },
      ]
      if (finalText) turnHistory.push({ role: "assistant", content: finalText })
      historyRef.current = [...historyRef.current, ...turnHistory].slice(-8)
    },
    [activeModel, apiKey, patchTurn, provider, pushText, running]
  )

  const stop = () => abortRef.current?.abort()

  const send = () => {
    const value = input.trim()
    if (!value || running) return
    setInput("")
    if (areaRef.current) areaRef.current.style.height = "auto"
    void run(value)
  }

  const submitTerm = () => {
    const command = termInput.trim()
    if (!command) return
    setTermInput("")
    setTermLines((prev) => [...prev, { kind: "cmd", text: command }])
    if (command === "clear") {
      setTermLines([])
      return
    }
    const result = runShell(files, command)
    if (result.files !== files) {
      setFiles(result.files)
      saveFiles(result.files)
    }
    setTermLines((prev) => [...prev, ...result.lines])
    if (result.preview) {
      setPreview(result.preview)
      setPreviewOpen(true)
    }
  }

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const isOpen = (id: string) => openGroups.has(id)

  const groupRow = (group: AgentGroup) => {
    const open = isOpen(group.id)
    const ic = ICON_FOR[iconKind(group.actions)]
    const label =
      group.status === "running"
        ? RUNNING[group.current ?? group.actions[0] ?? "cmd"]
        : group.summary ?? ""
    return (
      <div
        key={group.id}
        className={`grp ${group.status === "running" ? "running" : ""} ${open ? "open" : ""}`}
      >
        <div
          className="grp-row"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => {
            toggleGroup(group.id)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              toggleGroup(group.id)
            }
          }}
        >
          <span className={`ico ${group.status === "done" ? ic.cls : ""}`}>
            {group.status === "running" ? (
              <span className="spinner" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: ic.svg }} />
            )}
          </span>
          <span className="lbl">{label}</span>
        </div>
        <div className="detail">
          <div className="inner">
            {group.details.map(([k, v], i) => (
              <div className="dline" key={i}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }


  const fileNames = Object.keys(files).sort()

  return (
    <div className={ACTIVITY} style={{ height: "100%" }}>
      <button className="specbtn" type="button" onClick={() => setSpecOpen(true)}>
        Specs
      </button>

      <div className="phone">
        <div className="chatwrap">
          <div className="chat" ref={chatRef}>
            {entries.length === 0 ? (
              <div className="empty">
                <b>قسم الكود يعمل داخل هذا المتصفح.</b>
                <br />
                اطلب موقعاً أو تطبيقاً: يكتب الملفات، ينفّذ الأوامر في الطرفية المدمجة، يختبر الصفحة ثم يفتح المعاينة.
              </div>
            ) : null}

            {entries.map((entry) => {
              if (entry.kind === "user") {
                return (
                  <div className="user" key={entry.id}>
                    {entry.text}
                  </div>
                )
              }
              const turn = entry.data
              const label = turn.finishedAt
                ? `${turn.cancelled ? "Stopped after" : "Worked for"} ${fmt(
                    Math.max(1, Math.round(((turn.finishedAt ?? now) - turn.startedAt) / 1000))
                  )}`
                : `Working for ${fmt(Math.max(0, Math.floor((now - turn.startedAt) / 1000)))}`

              return (
                <div className={`turn ${turn.collapsed ? "collapsed" : ""}`} key={entry.id}>
                  <button
                    className="runhead"
                    type="button"
                    onClick={() =>
                      patchTurn(entry.id, (t) => ({ ...t, collapsed: !t.collapsed }))
                    }
                  >
                    <span>{label}</span>
                    <span dangerouslySetInnerHTML={{ __html: ICONS.chevron }} />
                  </button>
                  <div className="runbody">
                    <div className="inner">
                      {turn.blocks.map((block) =>
                        block.kind === "text" ? (
                          <div
                            className={`txt ${block.final ? "final" : ""}`}
                            dir="auto"
                            key={block.id}
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {block.text}
                          </div>
                        ) : (
                          groupRow(block.data)
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            className={`scrollbtn ${atBottom ? "" : "show"}`}
            type="button"
            aria-label="Scroll to bottom"
            onClick={() => {
              followRef.current = true
              scrollDown(true)
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: ICONS.chevron }} />
          </button>
        </div>

        {termOpen ? (
          <div className="term">
            <div className="term-head">
              <span>Terminal — /project</span>
              <button type="button" onClick={() => setTermOpen(false)} aria-label="Close terminal">
                ✕
              </button>
            </div>
            <div className="term-body" ref={termRef}>
              {termLines.length === 0 ? (
                <div className="term-line out">Type `help` to see what this shell can do.</div>
              ) : null}
              {termLines.map((line, i) => (
                <div className={`term-line ${line.kind}`} key={i}>
                  {line.kind === "cmd" ? <span className="prompt">~/project $ </span> : null}
                  {line.text}
                </div>
              ))}
            </div>
            <div className="term-input">
              <span>~/project $</span>
              <input
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitTerm()
                  }
                }}
                placeholder="npm run build"
                aria-label="Terminal command"
              />
            </div>
          </div>
        ) : null}

        <div className="composer">
          {menuOpen ? (
            <div className="menu" role="menu">
              <button type="button" onClick={() => { setTermOpen(true); setMenuOpen(false) }}>
                Terminal
              </button>
              <button
                type="button"
                disabled={!preview}
                onClick={() => { setPreviewOpen(true); setMenuOpen(false) }}
              >
                Preview
              </button>
              <button type="button" onClick={() => { setFilesOpen(true); setMenuOpen(false) }}>
                Files ({fileNames.length})
              </button>
            </div>
          ) : null}
          <textarea
            ref={areaRef}
            rows={3}
            dir="auto"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              const node = e.target
              node.style.height = "auto"
              node.style.height = `${Math.min(node.scrollHeight, 170)}px`
            }}
            onKeyDown={(e) => {
              const composing =
                (e.nativeEvent as unknown as { isComposing?: boolean }).isComposing ?? false
              if (e.key === "Enter" && !e.shiftKey && !composing) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="ابنِ لي صفحة هبوط عربية لمتجر قهوة مختصة، ثم اختبرها وافتح المعاينة."
          />
          <button
            className="suggest"
            type="button"
            hidden={input.trim().length > 0 || running}
            onClick={() => setInput(SUGGESTION)}
          >
            Use suggestion
          </button>
          <div className="crow">
            <div className="crow-left">
              <button
                className="plus"
                type="button"
                aria-label="Add"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span dangerouslySetInnerHTML={{ __html: ICONS.plus }} />
              </button>
              <button
                className="plus"
                type="button"
                aria-label="Terminal"
                onClick={() => setTermOpen((v) => !v)}
              >
                <span dangerouslySetInnerHTML={{ __html: ICONS.terminal }} />
              </button>
              <button
                className="plus"
                type="button"
                aria-label="Files"
                onClick={() => setFilesOpen(true)}
              >
                <span dangerouslySetInnerHTML={{ __html: ICONS.folder }} />
              </button>
            </div>
            <button
              className={`go ${running ? "stop" : ""}`}
              type="button"
              aria-label={running ? "Stop" : input.trim() ? "Send" : "Voice"}
              onClick={() => {
                if (running) {
                  stop()
                  return
                }
                if (input.trim()) send()
              }}
            >
              <span
                dangerouslySetInnerHTML={{
                  __html: running ? ICONS.stop : input.trim() ? ICONS.send : ICONS.wave,
                }}
              />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`pv ${previewOpen && preview ? "on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreviewOpen(false)
        }}
      >
        <div className="frame">
          <div className="bar">
            <span>{preview?.path ?? "Preview"}</span>
            <span className="bar-actions">
              <button type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </span>
          </div>
          <iframe title="Project preview" srcDoc={preview?.html ?? ""} sandbox="allow-scripts allow-forms allow-modals" />
        </div>
      </div>

      <div
        className={`spec ${filesOpen ? "on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setFilesOpen(false)
        }}
      >
        <div className="sheet files-sheet">
          <h2>ملفات المشروع (/project)</h2>
          {fileNames.length === 0 ? (
            <p className="files-empty">لا توجد ملفات بعد — اطلب مشروعاً ليبدأ الوكيل بالكتابة.</p>
          ) : (
            <ul className="files">
              {fileNames.map((path) => (
                <li key={path}>
                  <b>{path}</b>
                  <span>{files[path].length} bytes</span>
                </li>
              ))}
            </ul>
          )}
          <button className="close" type="button" onClick={() => setFilesOpen(false)}>
            Close
          </button>
        </div>
      </div>

      <div
        className={`spec ${specOpen ? "on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSpecOpen(false)
        }}
      >
        <div className="sheet">
          <h2>مواصفات العرض (تقديرية من اللقطة)</h2>
          <ul>
            <li><b>سطر الرأس:</b> نص رمادي <code>Worked for 17m 53s</code> + سهم صغير، حجم ≈ 17px، لون <code>#8e8e93</code>. أثناء التشغيل يتحول إلى <code>Working for ...</code> مع مؤقت حي. الضغط عليه يطوي/يفتح كل نشاط الدور.</li>
            <li><b>نص المساعد:</b> أبيض، ≈ 17px، ارتفاع سطر 1.55، والكود داخل شريحة (chip) صغيرة بخلفية داكنة وحدود رفيعة.</li>
            <li><b>مجموعة النشاط:</b> سطر واحد فقط: أيقونة 19px + ملخص رمادي ≈ 15.5px، بدون إطار ولا خلفية ولا بطاقة. المسافة العمودية بين الأسطر ≈ 29px. النص يُقصّ بـ <code>…</code> إذا طال.</li>
            <li><b>الأيقونة:</b> نجمة زرقاء = المجموعة فيها تفكير (thinking). غير ذلك حسب أول أداة: مقبس (plug) أزرق = متصفح/MCP، ملف أخضر = قراءة، ملف بقلم أخضر = تعديل، طرفية برتقالية = أوامر.</li>
            <li><b>الملخص:</b> يُولَّد تلقائياً بترتيب أول ظهور، بدون أرقام: مفرد إذا أداة واحدة (<code>Ran a command</code>) وجمع إذا أكثر (<code>Ran commands</code>)، أول حرف كبير، والفواصل <code>,</code>.</li>
            <li><b>أثناء التشغيل:</b> المجموعة الحالية فيها دائرة دوّارة ونص "ما يحدث الآن" (يلمع)، ثم تنطوي في ملخصها عند انتهائها.</li>
            <li><b>الضغط على السطر:</b> يفتح التفاصيل (هنا أسطر مبسطة، وفي التطبيق تُعرض بطاقات الأدوات الأصلية بدون أي تغيير بمحتواها).</li>
            <li><b>الأخطاء والموافقات:</b> لا تُطوى أبداً في التطبيق الحقيقي (غير ممثَّلة هنا).</li>
            <li><b>زر النزول:</b> دائري 40px بسهم لأسفل، يظهر في منتصف الأسفل فوق حقل الإدخال عندما تبتعد عن آخر المحادثة.</li>
            <li><b>حقل الإدخال:</b> إطار مدوّر بحد رفيع، الاقتراح كنص رمادي داخل الحقل، تحته <code>Use suggestion</code> كنص عادي، زر <code>+</code> على اليسار، وزر أخضر على اليمين: موجة صوت عند الفراغ ويتحول لسهم إرسال عند الكتابة (ومربع إيقاف أثناء التشغيل).</li>
            <li><b>الطرفية المدمجة:</b> تُفتح من زر الطرفية أو تلقائياً عند تنفيذ الوكيل أمراً، وتقبل الأوامر يدوياً: <code>ls</code>, <code>cat</code>, <code>node</code>, <code>npm run build</code>, <code>preview</code>.</li>
          </ul>
          <button className="close" type="button" onClick={() => setSpecOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
