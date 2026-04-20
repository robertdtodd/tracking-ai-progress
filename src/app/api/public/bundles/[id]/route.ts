import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const bundle = await prisma.bundle.findUnique({
    where: { id: params.id },
    include: {
      course: { select: { id: true, name: true, description: true } },
      messages: {
        where: { mode: 'discuss' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, createdAt: true },
      },
      highlights: {
        orderBy: { position: 'asc' },
        select: { id: true, anchorText: true, color: true, note: true, position: true },
      },
    },
  })
  if (!bundle || !bundle.published) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const articles = await prisma.userArticle.findMany({
    where: { title: { in: bundle.articleTitles } },
    select: {
      title: true,
      date: true,
      section: true,
      author: true,
      source: true,
      url: true,
    },
    orderBy: { date: 'desc' },
  })
  const seen = new Set<string>()
  const uniqueArticles = articles.filter((a) => {
    if (seen.has(a.title)) return false
    seen.add(a.title)
    return true
  })
  const linkedTitles = new Set(uniqueArticles.map((a) => a.title))
  const missingTitles = bundle.articleTitles.filter((t) => !linkedTitles.has(t))

  return NextResponse.json({
    id: bundle.id,
    title: bundle.title,
    themes: bundle.themes,
    generatedContent: bundle.generatedContent,
    publishedAt: bundle.publishedAt,
    course: bundle.course,
    articles: uniqueArticles,
    missingArticleTitles: missingTitles,
    messages: bundle.messages,
    highlights: bundle.highlights,
  })
}
