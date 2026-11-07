import { asJson, need, schema, str, type RuntimeTool } from "@/lib/connectors/types"

/** Tools that need no account and no key: real images and Wikipedia. */

type CommonsPage = {
  title: string
  index?: number
  imageinfo?: {
    thumburl?: string
    url: string
    descriptionurl: string
    mime?: string
    extmetadata?: Record<string, { value?: string }>
  }[]
}

const plain = (html?: string) =>
  (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`)
  return (await res.json()) as T
}

async function findImages(query: string, count: number) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(count * 3, 24)),
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "900",
    format: "json",
    origin: "*",
  })
  const data = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
    `https://commons.wikimedia.org/w/api.php?${params}`
  )
  const pages = Object.values(data.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  )
  const images = pages
    .map((p) => ({ page: p, info: p.imageinfo?.[0] }))
    .filter(({ info }) => info && /^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(info.mime ?? ""))
    .slice(0, count)
    .map(({ page, info }) => ({
      title: page.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " "),
      image: info?.thumburl ?? info?.url,
      page: info?.descriptionurl,
      license: info?.extmetadata?.LicenseShortName?.value,
      credit: plain(info?.extmetadata?.Artist?.value) || undefined,
    }))
  if (!images.length) throw new Error(`No images found for "${query}".`)
  return images
}

type Summary = {
  title: string
  description?: string
  extract?: string
  thumbnail?: { source: string }
  originalimage?: { source: string; width?: number }
  content_urls?: { desktop?: { page?: string } }
}

async function wikipedia(title: string, lang: string) {
  const host = `https://${lang.replace(/[^a-z-]/gi, "") || "en"}.wikipedia.org`
  const summary = (t: string) =>
    getJson<Summary>(`${host}/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`)
  let page: Summary
  try {
    page = await summary(title)
  } catch {
    const found = await getJson<[string, string[]]>(
      `${host}/w/api.php?action=opensearch&limit=1&format=json&origin=*&search=${encodeURIComponent(title)}`
    )
    if (!found[1]?.[0]) throw new Error(`Nothing found on Wikipedia for "${title}".`)
    page = await summary(found[1][0])
  }
  const original = page.originalimage
  const image =
    original && (original.width ?? 0) <= 2500 ? original.source : page.thumbnail?.source
  return {
    title: page.title,
    description: page.description,
    summary: page.extract,
    url: page.content_urls?.desktop?.page,
    image,
  }
}

export function webTools(): RuntimeTool[] {
  return [
    {
      name: "web_find_images",
      label: "find images",
      connectorId: "web",
      connectorName: "Web",
      description:
        "Find real, freely licensed photos and pictures on Wikimedia Commons for a topic (places, people, animals, landmarks, objects, diagrams, logos). Returns image addresses to show with Markdown ![caption](address). Use it when a picture would make the answer clearer.",
      parameters: schema(
        {
          query: { type: "string", description: "What to look for, in English works best." },
          count: { type: "number", description: "How many images, 1 to 8. Default 4." },
        },
        ["query"]
      ),
      write: false,
      run: async (a) => {
        need(a, "query")
        const count = Math.min(Math.max(Number(a.count) || 4, 1), 8)
        return asJson(await findImages(str(a, "query"), count))
      },
    },
    {
      name: "web_wikipedia",
      label: "wikipedia",
      connectorId: "web",
      connectorName: "Web",
      description:
        "Look a topic up on Wikipedia: a short summary, the page link and a main image address.",
      parameters: schema(
        {
          title: { type: "string", description: "Article title or topic." },
          language: { type: "string", description: "Wikipedia language code, e.g. en or ar. Default en." },
        },
        ["title"]
      ),
      write: false,
      run: async (a) => {
        need(a, "title")
        return asJson(await wikipedia(str(a, "title"), str(a, "language") || "en"))
      },
    },
  ]
}
