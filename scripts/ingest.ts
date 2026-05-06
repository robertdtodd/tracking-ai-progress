import * as fs from 'fs'
import * as path from 'path'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

import { prisma } from '../src/lib/db'
import { fetchRSSArticles } from '../src/lib/ingest/rss'
import { fetchArxivArticles } from '../src/lib/ingest/arxiv'
import { embedArticleIfMissing } from '../src/lib/ingest/embed'
import { summarizeArticleIfMissing } from '../src/lib/ingest/summarize'
import type { NormalizedArticle } from '../src/lib/ingest/types'

type RssSource = { type: 'rss'; url: string }
type ArxivSource = { type: 'arxiv'; query: string; maxResults?: number }
type SourceConfig = RssSource | ArxivSource | { type: string; [k: string]: unknown }

type FetchedItem = NormalizedArticle & {
  contentType: 'news' | 'paper'
  status: 'accepted' | 'pending'
  abstract: string | null
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
  console.warn(`  ! Topic "${topicName}" has unsupported ingest type "${src.type}" — skipping`)
  return []
}

async function processTopic(topic: {
  id: string
  name: string
  ingestConfig: unknown
}) {
  console.log(`\n=== Topic: ${topic.name} ===`)
  const sources = normalizeConfig(topic.ingestConfig)
  if (sources.length === 0) {
    console.log(`  (no sources configured)`)
    return
  }

  let inserted = 0
  let alreadyExisted = 0
  let errored = 0

  for (const src of sources) {
    console.log(`  → source: ${src.type}`)
    let items: FetchedItem[] = []
    try {
      items = await fetchSource(topic.name, src)
    } catch (err) {
      errored++
      console.error(`  ERROR fetching ${src.type}: ${(err as Error).message}`)
      continue
    }
    console.log(`    fetched ${items.length} candidates`)

    for (const a of items) {
      try {
        const existing = await prisma.article.findFirst({
          where: { source: a.source, sourceId: a.sourceId },
          select: { id: true },
        })

        let articleId: string
        if (existing) {
          articleId = existing.id
          alreadyExisted++
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
          inserted++
          const tag = a.contentType === 'paper' ? '?' : '+'
          console.log(`    ${tag} ${a.date} ${a.title.slice(0, 70)}`)
        }

        await prisma.topicArticle.upsert({
          where: { topicId_articleId: { topicId: topic.id, articleId } },
          create: { topicId: topic.id, articleId },
          update: {},
        })
      } catch (err) {
        errored++
        console.error(`    ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
      }
    }
  }

  console.log(`  Inserted: ${inserted} | Already had: ${alreadyExisted} | Errored: ${errored}`)
}

async function runEmbeddings() {
  console.log(`\n=== Embeddings: backfilling accepted articles ===`)
  const articles = await prisma.article.findMany({
    where: { status: 'accepted', embeddings: { none: {} } },
    select: { id: true, title: true, description: true, abstract: true, fullText: true },
    take: 1000,
  })
  console.log(`  ${articles.length} articles missing embeddings`)

  let embedded = 0
  let skipped = 0
  let errored = 0
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    try {
      const r = await embedArticleIfMissing(a)
      if (r === 'embedded') embedded++
      else skipped++
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${articles.length} processed`)
    } catch (err) {
      errored++
      console.error(`  ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
    }
  }
  console.log(`  Embedded: ${embedded} | Skipped: ${skipped} | Errored: ${errored}`)
}

async function runSummaries() {
  console.log(`\n=== Summaries: backfilling accepted articles ===`)
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
  console.log(`  ${articles.length} articles missing summaries`)

  let summarized = 0
  let skipped = 0
  let errored = 0
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    try {
      const r = await summarizeArticleIfMissing(a)
      if (r === 'summarized') summarized++
      else skipped++
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${articles.length} processed`)
    } catch (err) {
      errored++
      console.error(`  ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
    }
  }
  console.log(`  Summarized: ${summarized} | Skipped: ${skipped} | Errored: ${errored}`)
}

async function main() {
  const topicFilter = process.env.TOPIC
  const skipEmbeddings = process.env.SKIP_EMBEDDINGS === '1'
  const skipSummaries = process.env.SKIP_SUMMARIES === '1'

  const topics = await prisma.topic.findMany({
    where: topicFilter ? { name: topicFilter } : {},
    orderBy: { createdAt: 'asc' },
  })

  if (topics.length === 0) {
    console.log('No topics found. Run `npx tsx scripts/seed_topic.ts` to create one.')
    await prisma.$disconnect()
    return
  }

  for (const t of topics) {
    await processTopic(t)
  }

  if (!skipEmbeddings) {
    await runEmbeddings()
  } else {
    console.log('\n(SKIP_EMBEDDINGS=1 set — skipping embedding step)')
  }

  if (!skipSummaries) {
    await runSummaries()
  } else {
    console.log('\n(SKIP_SUMMARIES=1 set — skipping summary step)')
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
