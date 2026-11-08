export type TopicImage = { title: string; image: string; url: string }

type Summary = {
  type?: string
  title: string
  thumbnail?: { source: string }
  originalimage?: { source: string; width?: number }
  content_urls?: { desktop?: { page?: string } }
}

const cache = new Map<string, Promise<TopicImage | null>>()

/** Arabic topics are looked up on Arabic Wikipedia, everything else on English. */
const languageOf = (topic: string) => (/[\u0600-\u06FF]/.test(topic) ? "ar" : "en")

async function lookup(topic: string): Promise<TopicImage | null> {
  const host = `https://${languageOf(topic)}.wikipedia.org`

  const summary = async (title: string): Promise<Summary | null> => {
    const res = await fetch(
      `${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`
    )
    return res.ok ? ((await res.json()) as Summary) : null
  }
  const usable = (p: Summary | null): p is Summary =>
    Boolean(p && p.type !== "disambiguation" && (p.thumbnail || p.originalimage))

  let page = await summary(topic)
  if (!usable(page)) {
    const res = await fetch(
      `${host}/w/api.php?action=opensearch&limit=3&format=json&origin=*&search=${encodeURIComponent(topic)}`
    )
    const found = (await res.json()) as [string, string[]]
    page = null
    for (const title of found[1] ?? []) {
      const candidate = await summary(title)
      if (usable(candidate)) {
        page = candidate
        break
      }
    }
  }

  const image = page?.thumbnail?.source ?? page?.originalimage?.source
  if (!page || !image) return null
  return {
    title: page.title,
    image,
    url:
      page.content_urls?.desktop?.page ??
      `${host}/wiki/${encodeURIComponent(page.title)}`,
  }
}

/** The main picture of the Wikipedia article about a topic, or null. */
export function topicImage(topic: string): Promise<TopicImage | null> {
  const key = topic.trim().toLowerCase()
  let found = cache.get(key)
  if (!found) {
    found = lookup(topic.trim()).catch(() => null)
    cache.set(key, found)
  }
  return found
}
