import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { prisma } from '../db'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

let _client: OpenAI | null = null
function client(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set — embeddings cannot be generated')
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Cannot embed empty text')

  const res = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return res.data[0].embedding
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

type ArticleForEmbedding = {
  id: string
  title: string
  description: string | null
  abstract: string | null
  fullText: string | null
}

function buildEmbeddingText(a: ArticleForEmbedding): string {
  const parts: string[] = [a.title]
  if (a.abstract) parts.push(a.abstract)
  else if (a.description) parts.push(a.description)
  if (a.fullText) parts.push(a.fullText)
  return parts.join('\n\n').slice(0, 8000)
}

export async function embedArticleIfMissing(a: ArticleForEmbedding): Promise<'embedded' | 'skipped'> {
  const existing = await prisma.articleEmbedding.findFirst({
    where: { articleId: a.id, chunkIndex: 0 },
    select: { id: true },
  })
  if (existing) return 'skipped'

  const text = buildEmbeddingText(a)
  if (!text.trim()) return 'skipped'

  const vector = await embedText(text)
  const lit = vectorLiteral(vector)
  const id = randomUUID()

  await prisma.$executeRaw`
    INSERT INTO "ArticleEmbedding" ("id", "articleId", "chunkIndex", "text", "embedding")
    VALUES (${id}, ${a.id}, ${0}, ${text}, ${lit}::vector)
    ON CONFLICT ("articleId", "chunkIndex") DO NOTHING
  `
  return 'embedded'
}
