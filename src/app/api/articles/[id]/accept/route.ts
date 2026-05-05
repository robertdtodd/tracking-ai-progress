import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { embedArticleIfMissing } from '@/lib/ingest/embed'

export const maxDuration = 30

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      abstract: true,
      fullText: true,
      status: true,
    },
  })

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  await prisma.article.update({
    where: { id: params.id },
    data: { status: 'accepted', reviewedAt: new Date() },
  })

  // Embed inline so accepted papers are immediately queryable
  let embedStatus: 'embedded' | 'skipped' | 'error' = 'skipped'
  let embedError: string | null = null
  try {
    embedStatus = await embedArticleIfMissing(article)
  } catch (err) {
    embedStatus = 'error'
    embedError = (err as Error).message
  }

  return NextResponse.json({ ok: true, embedStatus, embedError })
}
