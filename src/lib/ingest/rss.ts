import Parser from 'rss-parser'
import type { NormalizedArticle } from './types'

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'tracking-ai-progress/1.0 (+rss-ingest)' },
})

function toIsoDate(input: string | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10)
  const d = new Date(input)
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export async function fetchRSSArticles(
  url: string,
  source: string,
): Promise<NormalizedArticle[]> {
  const feed = await parser.parseURL(url)
  const sectionLabel = feed.title?.trim() || 'rss'

  return (feed.items ?? [])
    .map((item): NormalizedArticle | null => {
      const title = item.title?.trim()
      const link = item.link?.trim() ?? null
      const sourceId = item.guid?.trim() || link
      if (!title || !sourceId) return null

      const description =
        item.contentSnippet?.trim() ||
        item.content?.trim() ||
        item.summary?.trim() ||
        null

      return {
        source,
        sourceId,
        title,
        author: item.creator?.trim() || item.author?.trim() || null,
        date: toIsoDate(item.isoDate || item.pubDate),
        section: sectionLabel,
        description,
        url: link,
      }
    })
    .filter((a): a is NormalizedArticle => a !== null)
}
