import { prisma } from './db'
import { articles, Article } from './articles'

export async function getAllArticles(): Promise<Article[]> {
  const userArticles = await prisma.userArticle.findMany({ orderBy: { createdAt: 'desc' } })
  return [
    ...articles,
    ...userArticles.map((ua) => ({
      d: ua.date,
      sec: ua.section,
      t: ua.title,
      by: ua.author,
      th: ua.themes as Record<string, string[]>,
    })),
  ]
}
