import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_RELEVANCE = ['supports', 'contradicts', 'context'] as const

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => ({}))
  const { articleId, relevance = 'supports', excerpt } = body as {
    articleId?: string
    relevance?: string
    excerpt?: string | null
  }

  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 })
  }
  if (!VALID_RELEVANCE.includes(relevance as (typeof VALID_RELEVANCE)[number])) {
    return NextResponse.json({ error: 'invalid relevance' }, { status: 400 })
  }

  await prisma.articleSupport.upsert({
    where: { insightId_articleId: { insightId: params.id, articleId } },
    create: { insightId: params.id, articleId, relevance, excerpt: excerpt ?? null },
    update: { relevance, excerpt: excerpt ?? null },
  })

  return NextResponse.json({ ok: true })
}
