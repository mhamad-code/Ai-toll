import { readItem, writeItem } from "@/lib/scope"

/**
 * The Code section's workspace: a small project that lives in this browser.
 * The agent writes real files here, the built-in terminal runs real commands
 * against them, and the preview renders the result.
 */
export type ProjectFiles = Record<string, string>

export type TerminalLine = { kind: "cmd" | "out" | "err"; text: string }

export type ShellResult = {
  lines: TerminalLine[]
  files: ProjectFiles
  exit: number
  preview?: { path: string; html: string }
}

const KEY = "code:workspace"

export const ROOT = "/project"

export function loadFiles(): ProjectFiles {
  try {
    const raw = readItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const files: ProjectFiles = {}
    for (const [path, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") files[path] = value
    }
    return files
  } catch {
    return {}
  }
}

export function saveFiles(files: ProjectFiles) {
  try {
    writeItem(KEY, JSON.stringify(files))
  } catch {
    // Storage full or blocked: the workspace keeps working in memory.
  }
}

/** `index.html` if there is one, otherwise the first page. */
export function entryPath(files: ProjectFiles): string | null {
  if (files["index.html"] !== undefined) return "index.html"
  const html = Object.keys(files).filter((p) => p.endsWith(".html")).sort()
  return html[0] ?? null
}

export function fileList(files: ProjectFiles): string[] {
  return Object.keys(files).sort()
}

export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\.?\//, "")
    .replace(/^\/project\//, "")
    .replace(/\/+/g, "/")
}

/** Inlines the project's own stylesheets and scripts so the page renders alone. */
export function buildPreview(files: ProjectFiles, path?: string): { path: string; html: string } | null {
  const entry = path ? normalizePath(path) : entryPath(files)
  if (!entry || files[entry] === undefined) return null
  let html = files[entry]

  html = html.replace(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    (tag, href: string) => {
      const target = normalizePath(href)
      if (files[target] === undefined) return tag
      return `<style>\n${files[target]}\n</style>`
    }
  )
  html = html.replace(
    /<script\b([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      const target = normalizePath(src)
      if (files[target] === undefined) return tag
      return `<script${before}${after}>\n${files[target]}\n</script>`
    }
  )
  html = html.replace(
    /<img\b([^>]*)src=["'](?!https?:|data:)([^"']+)["']([^>]*)>/gi,
    (tag) => tag
  )
  return { path: entry, html }
}

/** Executes JavaScript the way the browser would, with console captured. */
function runJavaScript(code: string, name: string): TerminalLine[] {
  const out: TerminalLine[] = []
  const push = (kind: TerminalLine["kind"], text: string) =>
    out.push({ kind, text })
  const fakeConsole = {
    log: (...args: unknown[]) => push("out", args.map(stringify).join(" ")),
    info: (...args: unknown[]) => push("out", args.map(stringify).join(" ")),
    warn: (...args: unknown[]) => push("err", args.map(stringify).join(" ")),
    error: (...args: unknown[]) => push("err", args.map(stringify).join(" ")),
  }
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("console", `"use strict";\n${code}`)
    fn(fakeConsole)
  } catch (error) {
    push("err", `${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return out
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** `npm run build`: real checks over the files the agent wrote. */
export function checkProject(files: ProjectFiles): { ok: boolean; lines: TerminalLine[] } {
  const lines: TerminalLine[] = []
  const error = (text: string) => lines.push({ kind: "err", text })
  const ok = (text: string) => lines.push({ kind: "out", text })
  const paths = fileList(files)

  if (!paths.length) {
    error("build: the project is empty — write some files first.")
    return { ok: false, lines }
  }

  const htmlFiles = paths.filter((p) => p.endsWith(".html"))
  if (!htmlFiles.length) error("build: no HTML page found (add index.html).")

  for (const path of htmlFiles) {
    const html = files[path]
    if (!/<html[\s>]/i.test(html)) error(`${path}: missing <html> tag.`)
    if (!/<\/body>/i.test(html)) error(`${path}: missing </body>.`)
    const refs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((ref) => !/^(https?:|data:|mailto:|#|\/\/)/i.test(ref))
    for (const ref of refs) {
      if (files[normalizePath(ref)] === undefined) {
        error(`${path}: missing local file "${normalizePath(ref)}".`)
      }
    }
  }

  for (const path of paths.filter((p) => /\.(m?js)$/.test(p))) {
    try {
      // eslint-disable-next-line no-new-func
      new Function(files[path])
      ok(`checked ${path}`)
    } catch (err) {
      error(`${path}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const failed = lines.some((l) => l.kind === "err")
  lines.push({
    kind: failed ? "err" : "out",
    text: failed ? "build failed" : `build passed — ${paths.length} file${paths.length === 1 ? "" : "s"}`,
  })
  return { ok: !failed, lines }
}

/** Runs one line the way the built-in terminal does. */
export function runShell(files: ProjectFiles, raw: string): ShellResult {
  const input = raw.trim()
  const next: ProjectFiles = { ...files }
  const lines: TerminalLine[] = []
  const out = (text: string) => lines.push({ kind: "out", text })
  const err = (text: string) => lines.push({ kind: "err", text })
  if (!input) return { files: next, lines, exit: 0 }

  const [name, ...rest] = input.split(/\s+/)
  const arg = rest.join(" ")

  switch (name) {
    case "help":
      out("pwd, ls, cat, mkdir, touch, rm, echo, node, npm run build, preview, git status, clear")
      return { files: next, lines, exit: 0 }

    case "clear":
      return { files: next, lines, exit: 0 }

    case "pwd":
      out(ROOT)
      return { files: next, lines, exit: 0 }

    case "whoami":
      out("builder")
      return { files: next, lines, exit: 0 }

    case "ls": {
      const dir = arg ? normalizePath(arg.replace(/\/$/, "")) + "/" : ""
      const names = Object.keys(next)
        .filter((p) => (dir ? p.startsWith(dir) : true))
        .map((p) => (dir ? p.slice(dir.length) : p))
        .filter((p) => p && !p.includes("/"))
        .sort()
      if (!names.length) out(dir ? `ls: ${dir} is empty` : "empty — the agent hasn't written files yet")
      else out(names.join("  "))
      return { files: next, lines, exit: 0 }
    }

    case "cat": {
      const path = normalizePath(arg)
      if (!path) return { files: next, lines: [ { kind: "err", text: "usage: cat <file>" } ], exit: 1 }
      if (next[path] === undefined) {
        err(`cat: ${path}: no such file`)
        return { files: next, lines, exit: 1 }
      }
      for (const line of next[path].split("\n")) out(line)
      return { files: next, lines, exit: 0 }
    }

    case "mkdir": {
      const path = normalizePath(arg.replace(/^-p\s+/, "")).replace(/\/$/, "")
      if (!path) return { files: next, lines: [ { kind: "err", text: "usage: mkdir <dir>" } ], exit: 1 }
      next[`${path}/.keep`] = ""
      out(`created ${path}/`)
      return { files: next, lines, exit: 0 }
    }

    case "touch": {
      const path = normalizePath(arg)
      if (!path) return { files: next, lines: [ { kind: "err", text: "usage: touch <file>" } ], exit: 1 }
      if (next[path] === undefined) next[path] = ""
      return { files: next, lines, exit: 0 }
    }

    case "rm": {
      const path = normalizePath(arg.replace(/^-rf?\s+/, ""))
      if (!path) return { files: next, lines: [ { kind: "err", text: "usage: rm <file>" } ], exit: 1 }
      if (next[path] === undefined) {
        err(`rm: ${path}: no such file`)
        return { files: next, lines, exit: 1 }
      }
      delete next[path]
      out(`removed ${path}`)
      return { files: next, lines, exit: 0 }
    }

    case "echo": {
      const match = input.match(/^echo\s+([\s\S]*?)(?:\s*(>>?)\s*([^\s>]+))?$/)
      const text = match?.[1] ?? ""
      const mode = match?.[2]
      const target = match?.[3] ? normalizePath(match[3]) : null
      const value = text.replace(/^["']|["']$/g, "")
      if (mode && target) {
        next[target] = mode === ">>" ? `${next[target] ?? ""}${value}\n` : `${value}\n`
        out(`wrote ${target}`)
      } else {
        out(value)
      }
      return { files: next, lines, exit: 0 }
    }

    case "node": {
      const path = normalizePath(arg)
      if (!path || next[path] === undefined) {
        err(`node: cannot find module '${path || "?"}'`)
        return { files: next, lines, exit: 1 }
      }
      const result = runJavaScript(next[path], path)
      return { files: next, lines: result, exit: result.some((l) => l.kind === "err") ? 1 : 0 }
    }

    case "npm": {
      if (/^run\s+build$/.test(arg) || arg === "build") {
        const { ok, lines: report } = checkProject(next)
        return { files: next, lines: report, exit: ok ? 0 : 1 }
      }
      if (/^install$/.test(arg) || arg === "i") {
        out("npm install — the browser workspace needs no packages")
        return { files: next, lines, exit: 0 }
      }
      if (/^test$/.test(arg) || /^run\s+test$/.test(arg)) {
        const { ok, lines: report } = checkProject(next)
        return { files: next, lines: report, exit: ok ? 0 : 1 }
      }
      err(`npm: unknown script "${arg}"`)
      return { files: next, lines, exit: 1 }
    }

    case "preview":
    case "open": {
      const target = arg ? normalizePath(arg) : undefined
      const built = buildPreview(next, target)
      if (!built) {
        err("preview: no HTML page to open")
        return { files: next, lines, exit: 1 }
      }
      out(`previewing ${built.path}`)
      return { files: next, lines, exit: 0, preview: built }
    }

    case "git":
      if (arg === "status" || arg === "") {
        if (!Object.keys(next).length) return { files: next, lines: [ { kind: "out", text: "nothing to commit, workspace empty" } ], exit: 0 }
        out(`on branch workspace`)
        for (const path of Object.keys(next).sort()) out(`  new file: ${path}`)
        return { files: next, lines, exit: 0 }
      }
      out("git: the workspace keeps its own history; publishing uses a branch")
      return { files: next, lines, exit: 0 }

    default:
      err(`${name}: command not found`)
      return { files: next, lines, exit: 127 }
  }
}
