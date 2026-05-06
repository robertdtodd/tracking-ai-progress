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
import { runIngest } from '../src/lib/ingest/run'

async function main() {
  const stats = await runIngest({
    topicName: process.env.TOPIC,
    skipEmbeddings: process.env.SKIP_EMBEDDINGS === '1',
    skipSummaries: process.env.SKIP_SUMMARIES === '1',
    log: (line) => console.log(line),
  })

  console.log(
    `\n=== Done in ${(stats.durationMs / 1000).toFixed(1)}s — inserted: ${stats.inserted} | already had: ${stats.alreadyExisted} | embedded: ${stats.embedded} | summarized: ${stats.summarized} | errors: ${stats.ingestErrored + stats.embedErrored + stats.summaryErrored} ===`,
  )

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
