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

export async function generateBundleFromOutline(
  outline: string,
  context: { courseName: string; sessionTitle?: string; slideTitle?: string },
): Promise<{ title: string; content: string }> {
  const sessionPart = context.sessionTitle ? `Session: ${context.sessionTitle}` : ''
  const slidePart = context.slideTitle ? `Slide: ${context.slideTitle}` : ''
  const ctxLines = [sessionPart, slidePart].filter(Boolean).join('\n')

  const personaBlock = `You are expanding a single slide outline into a long-form lesson companion for an AI literacy course called "${context.courseName}".

${AUTHOR_VOICE}

The instructor has authored a slide with a short outline. Your job is to expand that outline into a self-contained long-form lesson — the kind of piece a student or curious adult would read after the class to go deeper. The slide is the headline; this is the article behind it.

Use these exact section headers:

## Bottom line
One or two sentences synthesizing the core stake. Punchy, declarative.

## Overview
Two to three paragraphs framing what is actually going on, why it matters, and what makes it contested or consequential.

## This vs. That
Frame the disagreement as 2–4 concrete tensions, each with a "X vs. Y" header. For each pair, give one short paragraph laying out both sides — who holds each view, their reasoning, what's at stake. Do not strawman any side.

## Discussion Questions
Five to six open-ended questions for classroom or self-study. Mix factual, interpretive, and ethical. Discussable, not Google-able.

You do not have specific source articles for this expansion — write from your general knowledge and the slide outline. Do not fabricate specific citations or invented statistics. Keep claims at the level of well-established public knowledge or named ongoing debates. Where you would normally cite a specific article, instead reference the named entities, debates, or developments by description.`

  const userMessage = `${ctxLines}\n\nSLIDE OUTLINE:\n${outline}\n\nExpand this slide into a long-form lesson using the section headers specified.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: [{ type: 'text', text: personaBlock, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text.trim() : ''

  // Title: prefer the slide title if provided; otherwise derive from the first ## heading or outline.
  let title = context.slideTitle?.trim() || ''
  if (!title) {
    const firstHeading = text.match(/^##\s+(.+?)\s*$/m)
    title = firstHeading ? firstHeading[1] : outline.slice(0, 60)
  }

  return { title, content: text }
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

export type BeatContext = {
  position: number
  kind: string
  slideType: string | null
  title: string | null
  outline: string | null
  speakerNotes: string | null
  textBody: string | null
  chartSummary: string | null
  diagramDescription: string | null
  bundleTitle: string | null
  bundleSectionKey: string | null
  highlightQuote: string | null
  highlightNote: string | null
}

function formatBeatForContext(b: BeatContext): string {
  const parts: string[] = []
  parts.push(`Beat ${b.position + 1} (${b.kind}${b.slideType ? `/${b.slideType}` : ''})`)
  if (b.title) parts.push(`Title: ${b.title}`)
  if (b.outline) parts.push(`Outline: ${b.outline}`)
  if (b.textBody) parts.push(`Text body:\n${b.textBody}`)
  if (b.chartSummary) parts.push(`Chart: ${b.chartSummary}`)
  if (b.diagramDescription) parts.push(`Diagram: ${b.diagramDescription}`)
  if (b.bundleTitle) parts.push(`From lesson: "${b.bundleTitle}"${b.bundleSectionKey ? ` § ${b.bundleSectionKey}` : ''}`)
  if (b.highlightQuote) parts.push(`Highlight quote: "${b.highlightQuote}"`)
  if (b.highlightNote) parts.push(`Highlight note: ${b.highlightNote}`)
  if (b.speakerNotes) parts.push(`Speaker notes: ${b.speakerNotes}`)
  return parts.join('\n')
}

export async function discussWithBeat(
  courseName: string,
  sessionTitle: string,
  currentBeat: BeatContext,
  otherBeats: BeatContext[],
  chatHistory: { role: string; content: string }[],
  userMessage: string,
): Promise<string> {
  const otherBeatsList = otherBeats
    .map((b) => `- Beat ${b.position + 1}: ${b.title ?? b.outline ?? `(${b.kind}${b.slideType ? '/' + b.slideType : ''})`}`)
    .join('\n')

  const system = `You are a knowledgeable discussion partner helping a teacher and students explore a specific slide during a live classroom presentation in an AI literacy course called "${courseName}".

${AUTHOR_VOICE}

CURRENT SESSION: "${sessionTitle}"

ALL BEATS IN THIS SESSION (for navigation context):
${otherBeatsList || '(none)'}

CURRENT BEAT (the slide on screen right now):
${formatBeatForContext(currentBeat)}

Your role: answer questions about what is on this slide right now, offer context, surface connections to earlier or later beats in this session, and enrich the discussion. You are anchored to this specific beat — when a question is clearly about this slide, ground your answer in its content. When a question goes beyond, bring in relevant knowledge while being clear about what is from the slide vs. your own synthesis. Reference other beats by their position or title when useful.

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

export type ChartSlideOutput = {
  chartType: 'bar' | 'line'
  title: string
  xLabel: string
  yLabel: string
  data: Array<{ label: string; value: number }>
  dataNote?: string
  speakerNotes?: string
}

export async function generateChartSlide(
  outline: string,
  context: TextSlideContext = {},
): Promise<ChartSlideOutput> {
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

  const personaBlock = `You are generating a single chart slide for a classroom presentation.

${AUTHOR_VOICE}

Charts in this app are simple: a single series of labeled values, rendered as either a bar chart or a line chart. Pick the chart type that best fits the data — bar for categorical comparisons (companies, regions, years as buckets), line for trends over an ordered axis (year-over-year, time series).

CRITICAL — be honest about data:
- If you have specific real numbers from a verifiable source, use them and reflect that in the dataNote.
- If you are extrapolating or producing illustrative figures (because you don't have specific cited data for the exact axis the slide asks about), say so plainly in the dataNote: e.g. "Illustrative — directional estimate, not specific verified data" or "Order-of-magnitude approximation."
- Do not invent precise-looking numbers and present them as authoritative. The slide will be shown to an audience who deserves to know what kind of evidence backs the chart.

Use the report_chart_slide tool to return the chart. Keep titles short. Labels should be readable at presentation distance.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: [
      { type: 'text', text: personaBlock, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `PER-CALL CONTEXT:\n${contextBlock}` },
    ],
    tools: [
      {
        name: 'report_chart_slide',
        description: 'Return the chart slide.',
        input_schema: {
          type: 'object',
          properties: {
            chartType: {
              type: 'string',
              enum: ['bar', 'line'],
              description: 'bar for categorical comparisons; line for trends over an ordered axis.',
            },
            title: { type: 'string', description: 'Chart title, under 8 words.' },
            xLabel: { type: 'string', description: 'X-axis label.' },
            yLabel: { type: 'string', description: 'Y-axis label.' },
            data: {
              type: 'array',
              description: '4–12 labeled values.',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'number' },
                },
                required: ['label', 'value'],
              },
            },
            dataNote: {
              type: 'string',
              description:
                'A short caveat about the source/precision of the data. Required when figures are illustrative or extrapolated. Omit only when reporting specific verified numbers.',
            },
            speakerNotes: {
              type: 'string',
              description:
                "What the instructor says aloud when showing this chart. 2–4 sentences. Point at what to notice, name the source/caveat, frame the takeaway. The teacher's script.",
            },
          },
          required: ['chartType', 'title', 'xLabel', 'yLabel', 'data'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'report_chart_slide' },
    messages: [{ role: 'user', content: outline }],
  })

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call the report_chart_slide tool')
  }
  return toolUse.input as ChartSlideOutput
}

export async function expandOutlineWithSearch(
  outline: string,
  context: { courseName?: string; sessionTitle?: string; slideType?: 'text' | 'diagram' | 'chart' } = {},
): Promise<string> {
  const courseLine = context.courseName ? `Course: ${context.courseName}` : ''
  const sessionLine = context.sessionTitle ? `Session: ${context.sessionTitle}` : ''
  const slideLine = context.slideType ? `Target slide type: ${context.slideType}` : ''
  const ctx = [courseLine, sessionLine, slideLine].filter(Boolean).join('\n')

  const system = `You are a research assistant for a classroom presentation.

The user has written a terse outline for one slide. Your job: use web search to gather current, specific facts that should inform that slide, then return a single rewritten outline that weaves those facts into the user's original framing.

You are NOT generating the slide. You are NOT producing HTML or visual content. You are rewriting the user's prompt into a richer, fact-laden version of itself that a downstream slide generator will use.

RULES:
- Preserve the user's original intent, framing, and any specific instructions about visual structure ("three boxes", "as a chart", etc.).
- Use web_search for current facts: named entities, dates, numbers, recent events, product specs. Keep searches to 1–3 focused queries.
- Add facts inline where they belong; do not add a separate "Sources:" section.
- Do not invent facts. If search doesn't surface something the user asked about, leave it as-is or note "(verify before presenting)".
- Output ONLY the rewritten outline as plain text. No preamble, no commentary, no markdown headers, no code fences. Just the outline.

${ctx ? `CONTEXT:\n${ctx}\n` : ''}USER'S OUTLINE:
${outline}`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [{ role: 'user', content: 'Research and expand the outline above.' }],
  })

  if (message.stop_reason === 'pause_turn') {
    console.warn(
      '[expandOutlineWithSearch] stop_reason=pause_turn — returning whatever text was produced',
    )
  }

  // Find the last text block — earlier blocks are server_tool_use / web_search_tool_result.
  const textBlocks = message.content.filter((b) => b.type === 'text')
  const last = textBlocks[textBlocks.length - 1]
  return last && last.type === 'text' ? last.text.trim() : ''
}

export async function generateDiagram(userPrompt: string): Promise<string> {
  const system = `You are generating a single self-contained HTML document that will render as a visual slide in a classroom presentation.

Requirements:
- Return ONLY the full HTML document in your final text response. No explanation, no markdown fences, nothing before <!DOCTYPE html> or after </html>.
- Completely self-contained: no external URLs, no external fonts, no external images, no CDNs. Everything inline.
- Use inline <style> for CSS and <svg> for diagrams. Use CSS @keyframes for any animation.
- Light background (#ffffff), dark foreground (#1a1a1a). Use a system sans-serif stack for text.
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
