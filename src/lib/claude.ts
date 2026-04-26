import Anthropic from '@anthropic-ai/sdk'
import { Article } from './articles'
import { VOICE_SAMPLES } from './voiceSamples'

export const anthropic = new Anthropic()

const MODEL = 'claude-opus-4-7'

const AUTHOR_VOICE = `AUTHOR VOICE & POV — this course is written by Robert Todd. Write in his voice:

- Stake a position in your opening; avoid neutral-hedge framings.
- Marshal concrete evidence: named companies, specific numbers, cited sources — not vague claims.
- Vary sentence length: short declarative punches among longer evidence-building sentences.
- Use "you" occasionally to draw the reader in.
- Be measured, not alarmist; show moral conviction without moralizing.
- When presenting conflict or critique, always surface alternatives — name who's trying a different path.
- Treat "intelligence" (human and AI) as something to rethink, not accept at face value.
- Assume the reader is an educated professional navigating AI change — not an engineer, not a doomsayer.
- Focus on systems (incentive structures, leadership, power, education) more than on technology alone.
- Skeptical of unchecked profit motive and power concentration; pro-AI done right, interested in augmentation over replacement.`

function formatArticles(titles: string[], all: Article[]): string {
  const selected = all.filter((a) => titles.includes(a.t))
  return selected
    .map((a) => {
      const themes = Object.entries(a.th)
        .map(([t, subs]) => (subs.length ? `${t} (${subs.join(', ')})` : t))
        .join('; ')
      const sourceLabel = a.source === 'guardian' ? 'Guardian' : a.source === 'nyt' ? 'NYT' : a.source ?? 'NYT'
      const urlPart = a.url ? ` | url: ${a.url}` : ''
      return `- "${a.t}" — ${sourceLabel}, ${a.sec}, ${a.d}${a.by ? `, by ${a.by}` : ''}${themes ? ` [${themes}]` : ''}${urlPart}`
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

${AUTHOR_VOICE}

The instructor has collected these NYT articles as source material:

${articleList}

${themes.length ? `Themes emphasized: ${themes.join(', ')}` : ''}

${bundleTitle ? `The instructor titled this lesson "${bundleTitle}".` : 'The instructor has not named this lesson — infer the central AI issue these articles illuminate and title accordingly.'}

Your job is to write a lesson about **the underlying AI issue** these articles reveal — not about the articles themselves. The articles are current-event entry points and evidence, not the subject. Students should finish the lesson understanding the issue, how it's evolving, and why it's contested — not a summary of news coverage.

Use these exact section headers:

## Bottom line
One or two sentences that synthesize the core tension or stake of this lesson. This is what a busy reader walks away with if they read nothing else. Punchy, declarative, not a summary of the articles.

## Overview
Two to three paragraphs framing the AI issue at stake — what is actually going on, why it matters, and what makes it contested or consequential. Use the articles as current evidence, but the reader should come away understanding the issue itself, not a recap of news stories.

## This vs. That
Frame the disagreement as 2–4 concrete tensions, each with a **"X vs. Y"** header (e.g., "Accelerationists vs. doomers", "Open weights vs. closed labs", "Worker protection vs. AI adoption"). For each pair, give one short paragraph laying out both sides — who holds each view, their reasoning, and what's at stake. Cite specific articles as evidence. Do not strawman any side. The point is to make the real disagreement legible.

## Relevant Facts
10–12 concrete, specific facts drawn from the articles that bear on the issue. Prioritize statistics, named people, dates, dollar figures, and specific events.

Each fact must end with a citation. When a URL is available for the source article, cite as a **markdown link** like: "OpenAI's revenue exceeded $5 billion in Q1 2026 ([NYT, Apr 2](https://www.nytimes.com/...))." When no URL is available, cite in plain text: "(NYT, Apr 2)".

Choose facts that illuminate the issue, not facts that merely summarize any single article.

## Discussion Questions
Five to six open-ended questions about the issue for classroom use. Mix factual-recall questions with interpretive and ethical ones. Questions should be discussable — not yes/no, not Google-able. Students should be debating the issue, not recapping the articles.

Use these exact section headers. The articles are your evidence; the issue is your subject.`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function discussWithBundle(
  courseName: string,
  bundleTitle: string,
  currentContent: string,
  articleTitles: string[],
  allArticles: Article[],
  chatHistory: { role: string; content: string }[],
  userMessage: string,
): Promise<string> {
  const articleList = formatArticles(articleTitles, allArticles)

  const system = `You are a knowledgeable discussion partner helping explore content from an AI literacy course called "${courseName}".

${AUTHOR_VOICE}

The course material is this lesson: "${bundleTitle}"

SOURCE ARTICLES:
${articleList}

LESSON CONTENT:
${currentContent}

Your role: answer questions, offer context, surface connections, and enrich the discussion. You are in "discuss mode" — you do NOT edit the lesson content. If the user's question is directly addressed in the lesson, reference it. If it goes beyond the lesson, bring in relevant knowledge while being clear about what is from the articles vs. your own synthesis.

BE CONCISE. This is live-classroom support — answers are read aloud or scanned quickly. Default to 2–3 sentences or a single tight paragraph. Expand only when the question genuinely calls for more. No preamble, no "Great question," no throat-clearing — answer directly. If a list is warranted, keep it short (3–4 items max).

Respond with your answer directly — no special formatting tags required.`

  const messages = [
    ...chatHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages,
  })

  const block = response.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

export type TextSlideContext = {
  courseName?: string
  sessionTitle?: string
  bundleTitle?: string
  bundleContent?: string
  articleTitles?: string[]
  allArticles?: Article[]
}

export async function generateTextSlide(
  outline: string,
  context: TextSlideContext = {},
): Promise<{ title: string; body: string; speakerNotes: string }> {
  const contextParts: string[] = []
  if (context.courseName) contextParts.push(`Course: ${context.courseName}`)
  if (context.sessionTitle) contextParts.push(`Session: ${context.sessionTitle}`)
  if (context.bundleTitle) contextParts.push(`Related lesson: ${context.bundleTitle}`)
  if (context.articleTitles && context.articleTitles.length && context.allArticles) {
    const list = formatArticles(context.articleTitles, context.allArticles)
    if (list) contextParts.push(`Source articles:\n${list}`)
  }
  if (context.bundleContent) {
    contextParts.push(`Lesson content for grounding:\n${context.bundleContent}`)
  }
  const contextBlock = contextParts.length ? contextParts.join('\n\n') : '(no additional context)'

  // Stable persona/voice/format block — cached for cost efficiency across slide generations.
  const personaBlock = `You are generating a single presentation slide for a classroom.

${AUTHOR_VOICE}

${VOICE_SAMPLES}

OUTPUT FORMAT — return the slide in this exact format, always all three tags:
<title>Short slide title, under 8 words.</title>
<body>The slide body. Markdown is allowed. Keep it tight: either a short paragraph (2–4 sentences) OR 3–5 bullets. Slides are read at a distance — favor punchy over comprehensive.</body>
<speaker_notes>What the instructor says aloud when showing this slide. 2–4 sentences. Can expand on what's on screen, name the evidence, point at the tension. This is the teacher's script, not the slide.</speaker_notes>`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: [
      { type: 'text', text: personaBlock, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `PER-CALL CONTEXT:\n${contextBlock}` },
    ],
    messages: [{ role: 'user', content: outline }],
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''
  const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/)
  const bodyMatch = text.match(/<body>([\s\S]*?)<\/body>/)
  const notesMatch = text.match(/<speaker_notes>([\s\S]*?)<\/speaker_notes>/)

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : text.trim(),
    speakerNotes: notesMatch ? notesMatch[1].trim() : '',
  }
}

export async function generateDiagram(userPrompt: string): Promise<string> {
  const system = `You are generating a single self-contained HTML document that will render as a visual slide in a classroom presentation.

Requirements:
- Return ONLY the full HTML document. No explanation, no markdown fences, nothing before <!DOCTYPE html> or after </html>.
- Completely self-contained: no external URLs, no external fonts, no external images, no CDNs. Everything inline.
- Use inline <style> for CSS and <svg> for diagrams. Use CSS @keyframes for any animation.
- Dark background (#0a0a0a), light foreground. Use a system sans-serif stack for text.
- Fill the viewport: set html, body { height: 100%; margin: 0 } and size the content to the viewport. Use viewBox on SVGs.
- Design for a 16:9 slide. Center content. Leave comfortable padding.
- Labels must be readable at presentation distance — font sizes >= 16px for body text, larger for headings.
- Inline <script> is allowed only if needed for an animation or interaction that CSS alone can't do. Never use fetch, XMLHttpRequest, localStorage, cookies, or any DOM API that reaches outside the document.
- Prefer clarity over decoration. A teacher is showing this to students — it should teach something at a glance.`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = message.content[0]
  const text = block.type === 'text' ? block.text : ''
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i)
  return fenced ? fenced[1].trim() : trimmed
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

${AUTHOR_VOICE}

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
