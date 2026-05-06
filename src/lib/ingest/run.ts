import { prisma } from '../db'
import { fetchRSSArticles } from './rss'
import { fetchArxivArticles } from './arxiv'
import { embedArticleIfMissing } from './embed'
import { summarizeArticleIfMissing } from './summarize'
import type { NormalizedArticle } from './types'

type RssSource = { type: 'rss'; url: string }
type ArxivSource = { type: 'arxiv'; query: string; maxResults?: number }
type SourceConfig = RssSource | ArxivSource | { type: string; [k: string]: unknown }

type FetchedItem = NormalizedArticle & {
  contentType: 'news' | 'paper'
  status: 'accepted' | 'pending'
  abstract: string | null
}

export type IngestStats = {
  topicsProcessed: number
  inserted: number
  alreadyExisted: number
  ingestErrored: number
  embedded: number
  summarized: number
  embedErrored: number
  summaryErrored: number
  durationMs: number
}

export type IngestOptions = {
  topicName?: string
  skipEmbeddings?: boolean
  skipSummaries?: boolean
  log?: (line: string) => void
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeConfig(cfg: unknown): SourceConfig[] {
  if (Array.isArray(cfg)) return cfg as SourceConfig[]
  if (cfg && typeof cfg === 'object') return [cfg as SourceConfig]
  return []
}

async function fetchSource(
  topicName: string,
  src: SourceConfig,
  log: (line: string) => void,
): Promise<FetchedItem[]> {
  if (src.type === 'rss' && typeof (src as RssSource).url === 'string') {
    const items = await fetchRSSArticles((src as RssSource).url, `rss:${slug(topicName)}`)
    return items.map((a) => ({ ...a, contentType: 'news', status: 'accepted', abstract: null }))
  }
  if (src.type === 'arxiv' && typeof (src as ArxivSource).query === 'string') {
    const a = src as ArxivSource
    const items = await fetchArxivArticles(a.query, `arxiv:${slug(topicName)}`, a.maxResults ?? 25)
    return items.map((it) => ({
      source: it.source,
      sourceId: it.sourceId,
      title: it.title,
      author: it.author,
      date: it.date,
      section: it.section,
      description: it.description,
      url: it.url,
      contentType: 'paper' as const,
      status: 'pending' as const,
      abstract: it.abstract,
    }))
  }
  log(`  ! Topic "${topicName}" has unsupported ingest type "${src.type}" — skipping`)
  return []
}

async function processTopic(
  topic: { id: string; name: string; ingestConfig: unknown },
  stats: IngestStats,
  log: (line: string) => void,
) {
  log(`\n=== Topic: ${topic.name} ===`)
  const sources = normalizeConfig(topic.ingestConfig)
  if (sources.length === 0) {
    log(`  (no sources configured)`)
    return
  }

  for (const src of sources) {
    log(`  → source: ${src.type}`)
    let items: FetchedItem[] = []
    try {
      items = await fetchSource(topic.name, src, log)
    } catch (err) {
      stats.ingestErrored++
      log(`  ERROR fetching ${src.type}: ${(err as Error).message}`)
      continue
    }
    log(`    fetched ${items.length} candidates`)

    for (const a of items) {
      try {
        const existing = await prisma.article.findFirst({
          where: { source: a.source, sourceId: a.sourceId },
          select: { id: true },
        })

        let articleId: string
        if (existing) {
          articleId = existing.id
          stats.alreadyExisted++
        } else {
          const created = await prisma.article.create({
            data: {
              source: a.source,
              sourceId: a.sourceId,
              title: a.title,
              author: a.author,
              date: a.date,
              section: a.section,
              description: a.description,
              url: a.url,
              abstract: a.abstract,
              contentType: a.contentType,
              status: a.status,
            },
            select: { id: true },
          })
          articleId = created.id
          stats.inserted++
          const tag = a.contentType === 'paper' ? '?' : '+'
          log(`    ${tag} ${a.date} ${a.title.slice(0, 70)}`)
        }

        await prisma.topicArticle.upsert({
          where: { topicId_articleId: { topicId: topic.id, articleId } },
          create: { topicId: topic.id, articleId },
          update: {},
        })
      } catch (err) {
        stats.ingestErrored++
        log(`    ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
      }
    }
  }
}

async function runEmbeddings(stats: IngestStats, log: (line: string) => void) {
  log(`\n=== Embeddings: backfilling accepted articles ===`)
  const articles = await prisma.article.findMany({
    where: { status: 'accepted', embeddings: { none: {} } },
    select: { id: true, title: true, description: true, abstract: true, fullText: true },
    take: 1000,
  })
  log(`  ${articles.length} articles missing embeddings`)

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    try {
      const r = await embedArticleIfMissing(a)
      if (r === 'embedded') stats.embedded++
      if ((i + 1) % 10 === 0) log(`  ${i + 1}/${articles.length} processed`)
    } catch (err) {
      stats.embedErrored++
      log(`  ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
    }
  }
}

async function runSummaries(stats: IngestStats, log: (line: string) => void) {
  log(`\n=== Summaries: backfilling accepted articles ===`)
  const articles = await prisma.article.findMany({
    where: { status: 'accepted', summary: null },
    select: {
      id: true,
      title: true,
      author: true,
      date: true,
      description: true,
      abstract: true,
      fullText: true,
      url: true,
    },
    take: 1000,
  })
  log(`  ${articles.length} articles missing summaries`)

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    try {
      const r = await summarizeArticleIfMissing(a)
      if (r === 'summarized') stats.summarized++
      if ((i + 1) % 10 === 0) log(`  ${i + 1}/${articles.length} processed`)
    } catch (err) {
      stats.summaryErrored++
      log(`  ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
    }
  }
}

export async function runIngest(opts: IngestOptions = {}): Promise<IngestStats> {
  const log = opts.log ?? (() => {})
  const stats: IngestStats = {
    topicsProcessed: 0,
    inserted: 0,
    alreadyExisted: 0,
    ingestErrored: 0,
    embedded: 0,
    summarized: 0,
    embedErrored: 0,
    summaryErrored: 0,
    durationMs: 0,
  }
  const start = Date.now()

  const topics = await prisma.topic.findMany({
    where: opts.topicName ? { name: opts.topicName } : {},
    orderBy: { createdAt: 'asc' },
  })

  if (topics.length === 0) {
    log('No topics found. Run scripts/seed_topic.ts to create one.')
    stats.durationMs = Date.now() - start
    return stats
  }

  for (const t of topics) {
    await processTopic(t, stats, log)
    stats.topicsProcessed++
  }

  if (!opts.skipEmbeddings) {
    await runEmbeddings(stats, log)
  } else {
    log('\n(skipping embedding step)')
  }

  if (!opts.skipSummaries) {
    await runSummaries(stats, log)
  } else {
    log('\n(skipping summary step)')
  }

  stats.durationMs = Date.now() - start
  return stats
}
