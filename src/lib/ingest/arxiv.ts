import Parser from 'rss-parser'
import type { NormalizedArticle } from './types'

type ArxivItem = {
  title?: string
  link?: string
  pubDate?: string
  isoDate?: string
  author?: string
  summary?: string
  content?: string
  contentSnippet?: string
  id?: string
}

const parser = new Parser<unknown, ArxivItem>({
  timeout: 20000,
  headers: { 'User-Agent': 'tracking-ai-progress/1.0 (+arxiv-ingest)' },
  customFields: {
    item: ['summary', 'id'],
  },
})

function toIsoDate(input: string | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10)
  const d = new Date(input)
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function cleanText(s: string | undefined): string | null {
  if (!s) return null
  return s.replace(/\s+/g, ' ').trim() || null
}

export type ArxivArticle = NormalizedArticle & { abstract: string | null }

export async function fetchArxivArticles(
  query: string,
  source: string,
  maxResults: number = 25,
): Promise<ArxivArticle[]> {
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`
  const feed = await parser.parseURL(url)

  return (feed.items ?? [])
    .map((item): ArxivArticle | null => {
      const title = cleanText(item.title)
      // arXiv item.id (or link) is like http://arxiv.org/abs/2401.12345v1
      const id = item.id?.trim() || item.link?.trim()
      if (!title || !id) return null

      const abstract = cleanText(item.summary || item.content || item.contentSnippet)

      return {
        source,
        sourceId: id,
        title,
        author: item.author?.trim() || null,
        date: toIsoDate(item.isoDate || item.pubDate),
        section: 'arxiv',
        description: abstract ? abstract.slice(0, 500) : null,
        url: item.link?.trim() || id,
        abstract,
      }
    })
    .filter((a): a is ArxivArticle => a !== null)
}
