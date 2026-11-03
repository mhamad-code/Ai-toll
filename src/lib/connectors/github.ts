import { getToken } from "@/lib/connectors/store"
import {
  asJson,
  need,
  schema,
  str,
  type RuntimeTool,
} from "@/lib/connectors/types"

const toB64 = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

const fromB64 = (b64: string) => {
  const bin = atob(b64.replace(/\s/g, ""))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/")

async function gh<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const { token } = getToken("github")
  if (!token) throw new Error("GitHub isn't connected. Connect it in Connectors.")
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  })
  if (res.status === 401) {
    throw new Error("GitHub rejected the token. Reconnect GitHub in Connectors.")
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : null) as T
}

type Repo = {
  full_name: string
  description: string | null
  private: boolean
  language: string | null
  stargazers_count: number
  updated_at: string
  html_url: string
  default_branch: string
}

const repoSummary = (r: Repo) => ({
  name: r.full_name,
  description: r.description,
  private: r.private,
  language: r.language,
  stars: r.stargazers_count,
  updated: r.updated_at,
  default_branch: r.default_branch,
  url: r.html_url,
})

const repoArgs = {
  owner: { type: "string", description: "Account or organization that owns the repo." },
  repo: { type: "string", description: "Repository name." },
}

type Content = {
  type: string
  name: string
  path: string
  sha: string
  size: number
  html_url: string
  content?: string
  encoding?: string
}

function tool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  write: boolean,
  run: RuntimeTool["run"]
): RuntimeTool {
  return {
    name: `github_${name}`,
    label: name.replace(/_/g, " "),
    connectorId: "github",
    connectorName: "GitHub",
    description,
    parameters,
    write,
    run,
  }
}

export function githubTools(): RuntimeTool[] {
  return [
    tool("get_me", "Show the signed-in GitHub account: login, name, plan and counts.", schema({}), false, async () => {
      const u = await gh<Record<string, unknown>>("/user")
      return asJson({
        login: u.login,
        name: u.name,
        email: u.email,
        bio: u.bio,
        public_repos: u.public_repos,
        private_repos: u.total_private_repos,
        followers: u.followers,
        following: u.following,
        url: u.html_url,
      })
    }),

    tool("list_repos", "List the signed-in user's repositories, most recently updated first.", schema({
      per_page: { type: "number", description: "How many to return (max 100). Default 30." },
      visibility: { type: "string", enum: ["all", "public", "private"] },
    }), false, async (a) => {
      const n = Math.min(Number(a.per_page) || 30, 100)
      const v = str(a, "visibility") || "all"
      const repos = await gh<Repo[]>(`/user/repos?sort=updated&per_page=${n}&visibility=${v}`)
      return asJson(repos.map(repoSummary))
    }),

    tool("get_repo", "Get details about one repository.", schema(repoArgs, ["owner", "repo"]), false, async (a) => {
      need(a, "owner", "repo")
      return asJson(repoSummary(await gh<Repo>(`/repos/${str(a, "owner")}/${str(a, "repo")}`)))
    }),

    tool("list_contents", "List the files and folders at a path in a repository.", schema({
      ...repoArgs,
      path: { type: "string", description: "Folder path. Empty for the root." },
      ref: { type: "string", description: "Branch, tag or commit." },
    }, ["owner", "repo"]), false, async (a) => {
      need(a, "owner", "repo")
      const ref = str(a, "ref") ? `?ref=${encodeURIComponent(str(a, "ref"))}` : ""
      const data = await gh<Content[] | Content>(`/repos/${str(a, "owner")}/${str(a, "repo")}/contents/${encodePath(str(a, "path"))}${ref}`)
      const list = Array.isArray(data) ? data : [data]
      return asJson(list.map((f) => ({ name: f.name, type: f.type, path: f.path, size: f.size, url: f.html_url })))
    }),

    tool("read_file", "Read a text file from a repository. Returns its content and sha.", schema({
      ...repoArgs,
      path: { type: "string" },
      ref: { type: "string", description: "Branch, tag or commit." },
    }, ["owner", "repo", "path"]), false, async (a) => {
      need(a, "owner", "repo", "path")
      const ref = str(a, "ref") ? `?ref=${encodeURIComponent(str(a, "ref"))}` : ""
      const f = await gh<Content>(`/repos/${str(a, "owner")}/${str(a, "repo")}/contents/${encodePath(str(a, "path"))}${ref}`)
      if (f.type !== "file" || !f.content) throw new Error("That path isn't a file.")
      const text = fromB64(f.content)
      return asJson({ path: f.path, sha: f.sha, url: f.html_url, content: text.length > 20000 ? `${text.slice(0, 20000)}\n…(truncated)` : text }, 24000)
    }),

    tool("search_code", "Search code across GitHub. Add `repo:owner/name` to the query to limit it to one repo.", schema({
      query: { type: "string" },
    }, ["query"]), false, async (a) => {
      need(a, "query")
      const r = await gh<{ total_count: number; items: { name: string; path: string; html_url: string; repository: { full_name: string } }[] }>(`/search/code?per_page=15&q=${encodeURIComponent(str(a, "query"))}`)
      return asJson({ total: r.total_count, results: r.items.map((i) => ({ repo: i.repository.full_name, path: i.path, url: i.html_url })) })
    }),

    tool("list_issues", "List issues in a repository (pull requests are marked).", schema({
      ...repoArgs,
      state: { type: "string", enum: ["open", "closed", "all"] },
    }, ["owner", "repo"]), false, async (a) => {
      need(a, "owner", "repo")
      const issues = await gh<{ number: number; title: string; state: string; user: { login: string }; html_url: string; pull_request?: unknown; labels: { name: string }[] }[]>(`/repos/${str(a, "owner")}/${str(a, "repo")}/issues?per_page=30&state=${str(a, "state") || "open"}`)
      return asJson(issues.map((i) => ({ number: i.number, title: i.title, state: i.state, author: i.user.login, labels: i.labels.map((l) => l.name), pull_request: Boolean(i.pull_request), url: i.html_url })))
    }),

    tool("list_pull_requests", "List pull requests in a repository.", schema({
      ...repoArgs,
      state: { type: "string", enum: ["open", "closed", "all"] },
    }, ["owner", "repo"]), false, async (a) => {
      need(a, "owner", "repo")
      const prs = await gh<{ number: number; title: string; state: string; user: { login: string }; html_url: string; head: { ref: string }; base: { ref: string } }[]>(`/repos/${str(a, "owner")}/${str(a, "repo")}/pulls?per_page=30&state=${str(a, "state") || "open"}`)
      return asJson(prs.map((p) => ({ number: p.number, title: p.title, state: p.state, author: p.user.login, from: p.head.ref, into: p.base.ref, url: p.html_url })))
    }),

    tool("create_or_update_file", "Create a file, or replace an existing one, with a commit. Changes the repository.", schema({
      ...repoArgs,
      path: { type: "string" },
      content: { type: "string", description: "The full new text of the file." },
      message: { type: "string", description: "Commit message." },
      branch: { type: "string", description: "Branch to commit to. Defaults to the default branch." },
    }, ["owner", "repo", "path", "content", "message"]), true, async (a) => {
      need(a, "owner", "repo", "path", "message")
      const base = `/repos/${str(a, "owner")}/${str(a, "repo")}/contents/${encodePath(str(a, "path"))}`
      const branch = str(a, "branch")
      let sha: string | undefined
      try {
        const existing = await gh<Content>(`${base}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`)
        sha = existing.sha
      } catch {
        // A missing file is fine: this creates it.
      }
      const r = await gh<{ commit: { sha: string; html_url: string }; content: { html_url: string } }>(base, {
        method: "PUT",
        body: JSON.stringify({ message: str(a, "message"), content: toB64(str(a, "content")), ...(branch ? { branch } : {}), ...(sha ? { sha } : {}) }),
      })
      return asJson({ ok: true, updated: Boolean(sha), commit: r.commit.html_url, file: r.content.html_url })
    }),

    tool("create_issue", "Open a new issue. Changes the repository.", schema({
      ...repoArgs,
      title: { type: "string" },
      body: { type: "string" },
      labels: { type: "array", items: { type: "string" } },
    }, ["owner", "repo", "title"]), true, async (a) => {
      need(a, "owner", "repo", "title")
      const r = await gh<{ number: number; html_url: string }>(`/repos/${str(a, "owner")}/${str(a, "repo")}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: str(a, "title"), body: str(a, "body"), labels: Array.isArray(a.labels) ? a.labels : undefined }),
      })
      return asJson({ ok: true, number: r.number, url: r.html_url })
    }),

    tool("comment_on_issue", "Comment on an issue or pull request. Changes the repository.", schema({
      ...repoArgs,
      issue_number: { type: "number" },
      body: { type: "string" },
    }, ["owner", "repo", "issue_number", "body"]), true, async (a) => {
      need(a, "owner", "repo", "issue_number", "body")
      const r = await gh<{ html_url: string }>(`/repos/${str(a, "owner")}/${str(a, "repo")}/issues/${Number(a.issue_number)}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: str(a, "body") }),
      })
      return asJson({ ok: true, url: r.html_url })
    }),

    tool("create_pull_request", "Open a pull request from an existing branch. Changes the repository.", schema({
      ...repoArgs,
      title: { type: "string" },
      head: { type: "string", description: "Branch with the changes." },
      base: { type: "string", description: "Branch to merge into." },
      body: { type: "string" },
    }, ["owner", "repo", "title", "head", "base"]), true, async (a) => {
      need(a, "owner", "repo", "title", "head", "base")
      const r = await gh<{ number: number; html_url: string }>(`/repos/${str(a, "owner")}/${str(a, "repo")}/pulls`, {
        method: "POST",
        body: JSON.stringify({ title: str(a, "title"), head: str(a, "head"), base: str(a, "base"), body: str(a, "body") }),
      })
      return asJson({ ok: true, number: r.number, url: r.html_url })
    }),
  ]
}
