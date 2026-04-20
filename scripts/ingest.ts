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
import { fetchNytAIArticles } from '../src/lib/ingest/nyt'
import { fetchGuardianAIArticles } from '../src/lib/ingest/guardian'
import { classifyArticle } from '../src/lib/ingest/classify'
import type { NormalizedArticle } from '../src/lib/ingest/types'

type Stats = { inserted: number; skippedExisting: number; skippedIrrelevant: number; errored: number }

async function processArticles(sourceLabel: string, articles: NormalizedArticle[]): Promise<Stats> {
  console.log(`\nFetched ${articles.length} ${sourceLabel} articles. Classifying + persisting…\n`)

  const stats: Stats = { inserted: 0, skippedExisting: 0, skippedIrrelevant: 0, errored: 0 }

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const prefix = `[${sourceLabel} ${i + 1}/${articles.length}]`

    if (!a.sourceId || !a.title) {
      console.log(`${prefix} SKIP (no id/title)`)
      stats.errored++
      continue
    }

    const existing = await prisma.userArticle.findFirst({
      where: { source: a.source, sourceId: a.sourceId },
    })
    if (existing) {
      stats.skippedExisting++
      continue
    }

    try {
      const cls = await classifyArticle(a.title, a.description)
      if (!cls.relevant) {
        stats.skippedIrrelevant++
        continue
      }

      await prisma.userArticle.create({
        data: {
          source: a.source,
          sourceId: a.sourceId,
          title: a.title,
          author: a.author,
          date: a.date,
          section: a.section,
          description: a.description,
          url: a.url,
          themes: cls.themes,
        },
      })
      stats.inserted++
      console.log(`${prefix} + ${a.date} ${a.title.slice(0, 70)}`)
    } catch (err) {
      stats.errored++
      console.error(`${prefix} ERROR: ${(err as Error).message}`)
    }
  }

  return stats
}

async function main() {
  const from = process.env.FROM || '2024-01-01'
  const to = process.env.TO || new Date().toISOString().slice(0, 10)
  const sources = (process.env.SOURCES || 'nyt,guardian').split(',').map((s) => s.trim().toLowerCase())

  const totals: Stats = { inserted: 0, skippedExisting: 0, skippedIrrelevant: 0, errored: 0 }

  if (sources.includes('nyt')) {
    console.log(`\n=== NYT ingestion: ${from} → ${to} ===\n`)
    const nytArticles = await fetchNytAIArticles({
      beginDate: from,
      endDate: to,
      onProgress: (s) => console.log(s),
    })
    const s = await processArticles('NYT', nytArticles)
    totals.inserted += s.inserted
    totals.skippedExisting += s.skippedExisting
    totals.skippedIrrelevant += s.skippedIrrelevant
    totals.errored += s.errored
  }

  if (sources.includes('guardian')) {
    console.log(`\n=== Guardian ingestion: ${from} → ${to} ===\n`)
    const guardianArticles = await fetchGuardianAIArticles({
      beginDate: from,
      endDate: to,
      onProgress: (s) => console.log(s),
    })
    const s = await processArticles('Guardian', guardianArticles)
    totals.inserted += s.inserted
    totals.skippedExisting += s.skippedExisting
    totals.skippedIrrelevant += s.skippedIrrelevant
    totals.errored += s.errored
  }

  console.log(`\n=== Totals ===`)
  console.log(`Inserted:             ${totals.inserted}`)
  console.log(`Skipped (existing):   ${totals.skippedExisting}`)
  console.log(`Skipped (not AI):     ${totals.skippedIrrelevant}`)
  console.log(`Errored:              ${totals.errored}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
