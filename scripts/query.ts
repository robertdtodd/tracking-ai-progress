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
import { embedText } from '../src/lib/ingest/embed'

type Hit = {
  articleId: string
  title: string
  date: string
  source: string
  url: string | null
  distance: number
}

async function main() {
  const query = process.argv.slice(2).join(' ').trim()
  if (!query) {
    console.error('Usage: npx tsx scripts/query.ts "your question here"')
    process.exit(1)
  }
  const k = Number(process.env.K || 5)
  const topicFilter = process.env.TOPIC

  console.log(`Query: ${query}\n`)
  const queryVector = await embedText(query)
  const lit = `[${queryVector.join(',')}]`

  const hits = topicFilter
    ? await prisma.$queryRaw<Hit[]>`
        SELECT a."id" AS "articleId",
               a."title", a."date", a."source", a."url",
               (e."embedding" <=> ${lit}::vector) AS "distance"
        FROM "ArticleEmbedding" e
        JOIN "UserArticle" a ON a."id" = e."articleId"
        JOIN "TopicArticle" ta ON ta."articleId" = a."id"
        JOIN "Topic" t ON t."id" = ta."topicId"
        WHERE t."name" = ${topicFilter}
          AND a."status" = 'accepted'
        ORDER BY e."embedding" <=> ${lit}::vector
        LIMIT ${k}
      `
    : await prisma.$queryRaw<Hit[]>`
        SELECT a."id" AS "articleId",
               a."title", a."date", a."source", a."url",
               (e."embedding" <=> ${lit}::vector) AS "distance"
        FROM "ArticleEmbedding" e
        JOIN "UserArticle" a ON a."id" = e."articleId"
        WHERE a."status" = 'accepted'
        ORDER BY e."embedding" <=> ${lit}::vector
        LIMIT ${k}
      `

  if (hits.length === 0) {
    console.log('No results. (Are there any accepted articles with embeddings?)')
  } else {
    console.log(`Top ${hits.length} results${topicFilter ? ` (filtered to topic "${topicFilter}")` : ''}:\n`)
    for (const h of hits) {
      const sim = (1 - Number(h.distance)).toFixed(3)
      console.log(`[similarity ${sim}] ${h.date} — ${h.title}`)
      console.log(`  source: ${h.source}${h.url ? ` | ${h.url}` : ''}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
