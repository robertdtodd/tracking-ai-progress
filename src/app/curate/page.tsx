import { prisma } from '@/lib/db'
import CurationView, { type PendingArticle } from '@/components/CurationView'

export const dynamic = 'force-dynamic'

export default async function CuratePage() {
  const rows = await prisma.article.findMany({
    where: { status: 'pending' },
    orderBy: { ingestedAt: 'desc' },
    include: {
      topics: {
        include: { topic: { select: { name: true } } },
      },
    },
  })

  const articles: PendingArticle[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    author: a.author,
    date: a.date,
    abstract: a.abstract,
    description: a.description,
    url: a.url,
    source: a.source,
    contentType: a.contentType,
    topics: a.topics.map((t) => t.topic.name),
  }))

  return <CurationView articles={articles} />
}
