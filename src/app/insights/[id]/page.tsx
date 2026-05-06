import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import InsightView, { type InsightDetail, type SupportingArticle } from '@/components/InsightView'

export const dynamic = 'force-dynamic'

export default async function InsightDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const insight = await prisma.insight.findUnique({
    where: { id: params.id },
    include: {
      topics: { include: { topic: { select: { id: true, name: true } } } },
      supports: {
        orderBy: { addedAt: 'desc' },
        include: {
          article: {
            select: {
              id: true,
              title: true,
              date: true,
              source: true,
              url: true,
              description: true,
              abstract: true,
              summary: true,
              contentType: true,
            },
          },
        },
      },
    },
  })

  if (!insight) notFound()

  const allTopics = await prisma.topic.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const detail: InsightDetail = {
    id: insight.id,
    title: insight.title,
    stance: insight.stance,
    bottomLine: insight.bottomLine,
    rationale: insight.rationale,
    openQuestions: insight.openQuestions,
    topicIds: insight.topics.map((t) => t.topicId),
    updatedAt: insight.updatedAt.toISOString(),
  }

  const supports: SupportingArticle[] = insight.supports.map((s) => ({
    articleId: s.articleId,
    title: s.article.title,
    date: s.article.date,
    source: s.article.source,
    url: s.article.url,
    description: s.article.description,
    abstract: s.article.abstract,
    summary: s.article.summary,
    contentType: s.article.contentType,
    relevance: s.relevance,
    excerpt: s.excerpt,
  }))

  return <InsightView insight={detail} supports={supports} allTopics={allTopics} />
}
