import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { embedArticleIfMissing } from '@/lib/ingest/embed'
import { summarizeArticleIfMissing } from '@/lib/ingest/summarize'

export const maxDuration = 60

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      author: true,
      date: true,
      description: true,
      abstract: true,
      fullText: true,
      url: true,
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

  let embedStatus: 'embedded' | 'skipped' | 'error' = 'skipped'
  let embedError: string | null = null
  try {
    embedStatus = await embedArticleIfMissing(article)
  } catch (err) {
    embedStatus = 'error'
    embedError = (err as Error).message
  }

  let summaryStatus: 'summarized' | 'skipped' | 'error' = 'skipped'
  let summaryError: string | null = null
  try {
    summaryStatus = await summarizeArticleIfMissing(article)
  } catch (err) {
    summaryStatus = 'error'
    summaryError = (err as Error).message
  }

  return NextResponse.json({
    ok: true,
    embedStatus,
    embedError,
    summaryStatus,
    summaryError,
  })
}
