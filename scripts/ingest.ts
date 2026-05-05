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
import { embedArticleIfMissing } from '../src/lib/ingest/embed'
import type { NormalizedArticle } from '../src/lib/ingest/types'

type IngestConfig = { type: 'rss'; url: string } | { type: string; [k: string]: unknown }

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function fetchForTopic(topic: {
  name: string
  ingestConfig: unknown
}): Promise<NormalizedArticle[]> {
  const cfg = topic.ingestConfig as IngestConfig
  if (cfg.type === 'rss' && typeof cfg.url === 'string') {
    return fetchRSSArticles(cfg.url, `rss:${slug(topic.name)}`)
  }
  console.warn(`  ! Topic "${topic.name}" has unsupported ingest type "${cfg.type}" — skipping`)
  return []
}

async function processTopic(topic: {
  id: string
  name: string
  ingestConfig: unknown
}) {
  console.log(`\n=== Topic: ${topic.name} ===`)
  const articles = await fetchForTopic(topic)
  console.log(`  Fetched ${articles.length} candidate articles`)

  let inserted = 0
  let alreadyExisted = 0
  let errored = 0

  for (const a of articles) {
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
            contentType: 'news',
            status: 'accepted',
          },
          select: { id: true },
        })
        articleId = created.id
        inserted++
        console.log(`  + ${a.date} ${a.title.slice(0, 70)}`)
      }

      await prisma.topicArticle.upsert({
        where: { topicId_articleId: { topicId: topic.id, articleId } },
        create: { topicId: topic.id, articleId },
        update: {},
      })
    } catch (err) {
      errored++
      console.error(`  ERROR "${a.title.slice(0, 60)}": ${(err as Error).message}`)
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

async function main() {
  const topicFilter = process.env.TOPIC
  const skipEmbeddings = process.env.SKIP_EMBEDDINGS === '1'

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

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
