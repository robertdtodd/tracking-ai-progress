import Anthropic from '@anthropic-ai/sdk'
import { Article } from './articles'

export const anthropic = new Anthropic()

const MODEL = 'claude-opus-4-7'

function formatArticles(titles: string[], all: Article[]): string {
  const selected = all.filter((a) => titles.includes(a.t))
  return selected
    .map((a) => {
      const themes = Object.entries(a.th)
        .map(([t, subs]) => (subs.length ? `${t} (${subs.join(', ')})` : t))
        .join('; ')
      return `- "${a.t}" — ${a.sec}, ${a.d}${a.by ? `, by ${a.by}` : ''}${themes ? ` [${themes}]` : ''}`
    })
    .join('\n')
}

export async function generateBundleContent(
  courseName: string,
  bundleTitle: string,
  articleTitles: string[],
  themes: string[],
  allArticles: Article[],
): Promise<string> {
  const articleList = formatArticles(articleTitles, allArticles)
  const prompt = `You are creating educational content for an AI literacy course called "${courseName}".

The instructor has assembled this lesson bundle titled "${bundleTitle}". Source material:

${articleList}

${themes.length ? `Themes emphasized: ${themes.join(', ')}` : ''}

Write a comprehensive lesson synthesis (roughly 800–1200 words) that:
1. Opens with a compelling framing of why these articles matter together
2. Identifies and explains 2–4 major themes or tensions across the articles
3. Highlights specific examples or details that illuminate the key points
4. Connects these developments to broader patterns in AI's trajectory
5. Closes with 3–4 discussion questions for classroom conversation

Use clear section headers (markdown style). This is a synthesis — identify what's interesting about how these articles speak to each other. Do not simply summarize each article.`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function chatWithBundle(
  courseName: string,
  bundleTitle: string,
  currentContent: string,
  articleTitles: string[],
  allArticles: Article[],
  chatHistory: { role: string; content: string }[],
  userMessage: string,
): Promise<{ assistantMessage: string; updatedContent: string }> {
  const articleList = formatArticles(articleTitles, allArticles)

  const system = `You are helping an instructor refine educational content for an AI literacy course called "${courseName}".

Current lesson: "${bundleTitle}"

SOURCE ARTICLES:
${articleList}

CURRENT LESSON CONTENT:
${currentContent}

Respond in this exact format, always including BOTH tags:
<message>Your reply to the instructor — what you changed or your answer to their question. Keep it conversational and brief.</message>
<updated_content>The full updated lesson content. If no changes are needed (e.g. the instructor asked a question), return the current content unchanged.</updated_content>`

  const messages = [
    ...chatHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages,
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''

  const msgMatch = text.match(/<message>([\s\S]*?)<\/message>/)
  const contentMatch = text.match(/<updated_content>([\s\S]*?)<\/updated_content>/)

  return {
    assistantMessage: msgMatch ? msgMatch[1].trim() : text.trim(),
    updatedContent: contentMatch ? contentMatch[1].trim() : currentContent,
  }
}
