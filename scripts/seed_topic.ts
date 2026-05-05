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

async function main() {
  const name = 'AI Skills'
  const description = 'what does it look like to be good at interacting with machine intelligence'
  const ingestConfig = {
    type: 'rss',
    url: 'https://simonwillison.net/atom/everything/',
  }

  const topic = await prisma.topic.upsert({
    where: { name },
    create: { name, description, ingestConfig },
    update: { description, ingestConfig },
  })

  console.log(`Topic ready: "${topic.name}" (${topic.id})`)
  console.log(`  description: ${topic.description}`)
  console.log(`  ingestConfig:`, topic.ingestConfig)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
