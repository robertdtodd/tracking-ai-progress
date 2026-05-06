import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { embedText } from '@/lib/ingest/embed'

export const maxDuration = 30

type Hit = {
  articleId: string
  title: string
  date: string
  source: string
  url: string | null
  description: string | null
  abstract: string | null
  summary: string | null
  contentType: string
  distance: number
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { query, topicIds, k = 10 } = body as {
    query?: string
    topicIds?: string[]
    k?: number
  }

  if (!query || typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }
  const limit = Math.max(1, Math.min(50, Number(k) || 10))

  const vector = await embedText(query)
  const lit = `[${vector.join(',')}]`

  const hits =
    topicIds && topicIds.length > 0
      ? await prisma.$queryRaw<Hit[]>`
          SELECT a."id" AS "articleId",
                 a."title", a."date", a."source", a."url",
                 a."description", a."abstract", a."summary", a."contentType",
                 (e."embedding" <=> ${lit}::vector) AS "distance"
          FROM "ArticleEmbedding" e
          JOIN "UserArticle" a ON a."id" = e."articleId"
          WHERE a."status" = 'accepted'
            AND EXISTS (
              SELECT 1 FROM "TopicArticle" ta
              WHERE ta."articleId" = a."id" AND ta."topicId" = ANY(${topicIds}::text[])
            )
          ORDER BY e."embedding" <=> ${lit}::vector
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<Hit[]>`
          SELECT a."id" AS "articleId",
                 a."title", a."date", a."source", a."url",
                 a."description", a."abstract", a."summary", a."contentType",
                 (e."embedding" <=> ${lit}::vector) AS "distance"
          FROM "ArticleEmbedding" e
          JOIN "UserArticle" a ON a."id" = e."articleId"
          WHERE a."status" = 'accepted'
          ORDER BY e."embedding" <=> ${lit}::vector
          LIMIT ${limit}
        `

  return NextResponse.json({
    hits: hits.map((h) => ({
      articleId: h.articleId,
      title: h.title,
      date: h.date,
      source: h.source,
      url: h.url,
      description: h.description,
      abstract: h.abstract,
      summary: h.summary,
      contentType: h.contentType,
      similarity: 1 - Number(h.distance),
    })),
  })
}
