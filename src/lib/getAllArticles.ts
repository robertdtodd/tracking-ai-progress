import { prisma } from './db'
import { Article } from './articles'

export async function getAllArticles(): Promise<Article[]> {
  const userArticles = await prisma.userArticle.findMany({ orderBy: { createdAt: 'desc' } })
  return userArticles.map((ua) => ({
    d: ua.date,
    sec: ua.section,
    t: ua.title,
    by: ua.author,
    th: ua.themes as Record<string, string[]>,
    url: ua.url,
    source: ua.source,
  }))
}
