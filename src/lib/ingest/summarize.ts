import { anthropic } from '../claude'
import { prisma } from '../db'

const SUMMARY_MODEL = 'claude-haiku-4-5-20251001'

type ArticleForSummary = {
  id: string
  title: string
  author: string | null
  date: string
  description: string | null
  abstract: string | null
  fullText: string | null
  url: string | null
}

function buildSourceText(a: ArticleForSummary): string | null {
  const body = a.fullText || a.abstract || a.description
  if (!body || !body.trim()) return null
  // Cap length so we don't burn tokens on long papers
  return body.slice(0, 6000)
}

export async function summarizeArticle(a: ArticleForSummary): Promise<string | null> {
  const body = buildSourceText(a)
  if (!body) return null

  const meta = [
    `Title: ${a.title}`,
    a.author ? `Author: ${a.author}` : null,
    a.date ? `Date: ${a.date}` : null,
    a.url ? `URL: ${a.url}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const userMessage = `${meta}

Content:
${body}

Summarize the above in 2–3 short sentences. Capture what the piece argues, claims, or describes — be specific about names, numbers, and concrete claims when present. Skip any preamble like "This article…". Just write the summary text.`

  const res = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = res.content[0]
  if (!block || block.type !== 'text') return null
  const text = block.text.trim()
  return text || null
}

export async function summarizeArticleIfMissing(
  a: ArticleForSummary,
): Promise<'summarized' | 'skipped'> {
  const summary = await summarizeArticle(a)
  if (!summary) return 'skipped'
  await prisma.article.update({
    where: { id: a.id },
    data: { summary },
  })
  return 'summarized'
}
