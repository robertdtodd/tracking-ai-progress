import type { NormalizedArticle } from './types'

const BASE = 'https://api.nytimes.com/svc/search/v2/articlesearch.json'

function toNytDate(ymd: string): string {
  return ymd.replace(/-/g, '')
}

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

export async function fetchNytAIArticles(opts: {
  beginDate: string
  endDate: string
  signal?: AbortSignal
  onProgress?: (msg: string) => void
}): Promise<NormalizedArticle[]> {
  const key = process.env.NYT_API_KEY
  if (!key) throw new Error('NYT_API_KEY not set in .env')

  const all: NormalizedArticle[] = []
  const seen = new Set<string>()
  const ranges = monthlyRanges(opts.beginDate, opts.endDate)

  for (const range of ranges) {
    if (opts.signal?.aborted) break
    opts.onProgress?.(`NYT ${range.label}…`)
    const monthArticles = await fetchMonth(range.start, range.end, key, opts.signal, opts.onProgress)
    for (const a of monthArticles) {
      if (a.sourceId && !seen.has(a.sourceId)) {
        seen.add(a.sourceId)
        all.push(a)
      }
    }
    opts.onProgress?.(`  ${range.label}: ${monthArticles.length} fetched (${all.length} total)`)
  }

  return all
}

async function fetchMonth(
  beginDate: string,
  endDate: string,
  key: string,
  signal?: AbortSignal,
  onProgress?: (msg: string) => void,
): Promise<NormalizedArticle[]> {
  const results: NormalizedArticle[] = []
  for (let page = 0; page < 100; page++) {
    if (signal?.aborted) break
    const url =
      `${BASE}?q=${encodeURIComponent('artificial intelligence')}` +
      `&begin_date=${toNytDate(beginDate)}&end_date=${toNytDate(endDate)}` +
      `&page=${page}&sort=newest&api-key=${key}`

    const res = await fetch(url, { signal })
    if (res.status === 429) {
      onProgress?.('  rate-limited, waiting 15s…')
      await sleep(15000, signal)
      page--
      continue
    }
    if (!res.ok) {
      throw new Error(`NYT API ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as { response?: { docs?: unknown[] } }
    const docs = data.response?.docs ?? []
    if (docs.length === 0) break

    for (const doc of docs) {
      results.push(normalize(doc as Record<string, any>))
    }

    await sleep(12500, signal)
  }
  return results
}

function normalize(doc: Record<string, any>): NormalizedArticle {
  return {
    source: 'nyt',
    sourceId: String(doc._id ?? ''),
    title: doc.headline?.main ?? '',
    author: (doc.byline?.original ?? '').replace(/^By /i, '').trim() || null,
    date: (doc.pub_date ?? '').slice(0, 10),
    section: doc.section_name ?? '',
    description: doc.abstract || doc.snippet || null,
    url: doc.web_url ?? null,
  }
}

function monthlyRanges(begin: string, end: string): Array<{ start: string; end: string; label: string }> {
  const ranges: Array<{ start: string; end: string; label: string }> = []
  let [y, m] = begin.slice(0, 7).split('-').map(Number)
  const [ey, em] = end.slice(0, 7).split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    const mm = String(m).padStart(2, '0')
    const monthStart = `${y}-${mm}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
    ranges.push({
      start: monthStart < begin ? begin : monthStart,
      end: monthEnd > end ? end : monthEnd,
      label: `${y}-${mm}`,
    })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return ranges
}
