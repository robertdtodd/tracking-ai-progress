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
import { summarizeArticleIfMissing } from '../src/lib/ingest/summarize'

async function main() {
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
    orderBy: { ingestedAt: 'desc' },
  })

  console.log(`${articles.length} accepted articles missing summaries`)

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

  console.log(`Summarized: ${summarized} | Skipped (no usable text): ${skipped} | Errored: ${errored}`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
