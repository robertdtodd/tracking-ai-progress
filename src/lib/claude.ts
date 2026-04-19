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

The instructor has assembled this lesson theme titled "${bundleTitle}". Source material:

${articleList}

${themes.length ? `Themes emphasized: ${themes.join(', ')}` : ''}

Write a structured lesson synthesis using these exact section headers:

## Overview
Two to three paragraphs framing why these articles matter together — what central tension, question, or development connects them? This should hook a curious reader.

## Conflicting Points of View
Present 2–4 genuine, distinct perspectives on the central issue. For each, name who holds that view and why — cite specific articles where you can. Do not strawman any side. The goal is to show that reasonable people disagree, and why.

## Relevant Facts
10–12 concrete, specific facts drawn directly from these articles. Write each as a single sentence ending with the source in parentheses, like: "OpenAI's revenue exceeded $5 billion in Q1 2026 (NYT, Apr 2)." Prioritize statistics, named people, dates, dollar figures, and specific events over vague claims.

## Discussion Questions
Five to six open-ended questions for classroom use. Mix factual-recall questions with interpretive and ethical ones. Questions should be discussable — not yes/no, not Google-able.

Use these exact section headers. Draw connections across articles rather than summarizing each one in sequence.`

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
