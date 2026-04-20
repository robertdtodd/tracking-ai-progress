import type { NormalizedArticle } from './types'

const BASE = 'https://content.guardianapis.com/search'

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null
  const stripped = s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return stripped || null
}

export async function fetchGuardianAIArticles(opts: {
  beginDate: string
  endDate: string
  signal?: AbortSignal
  onProgress?: (msg: string) => void
}): Promise<NormalizedArticle[]> {
  const key = process.env.GUARDIAN_API_KEY
  if (!key) throw new Error('GUARDIAN_API_KEY not set in .env')

  const all: NormalizedArticle[] = []
  const seen = new Set<string>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    if (opts.signal?.aborted) break

    const url = new URL(BASE)
    url.searchParams.set('tag', 'technology/artificialintelligenceai')
    url.searchParams.set('from-date', opts.beginDate)
    url.searchParams.set('to-date', opts.endDate)
    url.searchParams.set('page-size', '200')
    url.searchParams.set('page', String(page))
    url.searchParams.set('show-fields', 'trailText,byline')
    url.searchParams.set('order-by', 'newest')
    url.searchParams.set('api-key', key)

    const res = await fetch(url.toString(), { signal: opts.signal })
    if (!res.ok) {
      throw new Error(`Guardian API ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as {
      response?: { results?: unknown[]; pages?: number; total?: number }
    }

    totalPages = data.response?.pages ?? 1
    const results = data.response?.results ?? []

    opts.onProgress?.(
      `Guardian page ${page}/${totalPages}: ${results.length} fetched (${all.length + results.length} total)`,
    )

    for (const r of results) {
      const article = normalize(r as Record<string, any>)
      if (article.sourceId && !seen.has(article.sourceId)) {
        seen.add(article.sourceId)
        all.push(article)
      }
    }

    page++
    await sleep(1000, opts.signal)
  }

  return all
}

function normalize(doc: Record<string, any>): NormalizedArticle {
  return {
    source: 'guardian',
    sourceId: String(doc.id ?? ''),
    title: doc.webTitle ?? '',
    author: doc.fields?.byline ?? null,
    date: (doc.webPublicationDate ?? '').slice(0, 10),
    section: doc.sectionName ?? '',
    description: stripHtml(doc.fields?.trailText),
    url: doc.webUrl ?? null,
  }
}
