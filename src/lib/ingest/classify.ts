import Anthropic from '@anthropic-ai/sdk'
import { themeConfig } from '../articles'

const client = new Anthropic()

const themeList = themeConfig
  .map((t) =>
    t.subs.length ? `- ${t.name} — sub-topics: ${t.subs.join(', ')}` : `- ${t.name}`,
  )
  .join('\n')

const systemPrompt = `You classify news articles about artificial intelligence for an AI literacy course.

TASK: For each article, decide two things:
1. Is the article genuinely about AI as a central topic? (not merely mentioning AI in passing)
2. If relevant, which themes and sub-topics from our taxonomy apply?

THEME TAXONOMY:
${themeList}

RULES:
- Use theme names and sub-topic names EXACTLY as listed above — spelling, capitalization, and punctuation must match.
- Pick 1–3 themes at most (usually 1–2).
- Only include sub-topics that clearly fit. If a theme has no matching sub-topic in the list, use an empty array.
- If the article is not genuinely about AI as a central topic, return relevant=false and themes={}.

OUTPUT: Return a single JSON object, no other text, no markdown:
{"relevant": boolean, "themes": {"Theme Name": ["sub-topic 1"]}}`

export type Classification = {
  relevant: boolean
  themes: Record<string, string[]>
}

export async function classifyArticle(
  title: string,
  description: string | null,
): Promise<Classification> {
  const userMsg = `Article title: "${title}"${
    description ? `\nDescription: "${description}"` : ''
  }`

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMsg }],
  })

  const block = res.content[0]
  const text = block?.type === 'text' ? block.text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { relevant: false, themes: {} }

  try {
    const parsed = JSON.parse(match[0])
    return {
      relevant: Boolean(parsed.relevant),
      themes:
        parsed.themes && typeof parsed.themes === 'object' && !Array.isArray(parsed.themes)
          ? (parsed.themes as Record<string, string[]>)
          : {},
    }
  } catch {
    return { relevant: false, themes: {} }
  }
}
