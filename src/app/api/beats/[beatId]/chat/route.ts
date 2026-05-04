import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { discussWithBeat, type BeatContext } from '@/lib/claude'

export const maxDuration = 60

type GeneratedShape = {
  body?: string
  html?: string
  chartType?: 'bar' | 'line'
  title?: string
  xLabel?: string
  yLabel?: string
  data?: Array<{ label: string; value: number }>
  dataNote?: string | null
}

type BeatRow = {
  id: string
  position: number
  kind: string
  slideType: string | null
  title: string | null
  outline: string | null
  speakerNotes: string | null
  generated: unknown
  bundleId: string | null
  sectionKey: string | null
  bundle: { title: string; generatedContent: string } | null
  highlight: { anchorText: string; note: string | null } | null
}

function splitByH2(content: string): { heading: string; body: string }[] {
  const lines = content.split('\n')
  const sections: { heading: string; body: string }[] = []
  let current: { heading: string; body: string } | null = null
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      if (current) sections.push(current)
      current = { heading: m[1], body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    }
  }
  if (current) sections.push(current)
  return sections
}

function buildBeatContext(b: BeatRow): BeatContext {
  const gen = (b.generated ?? null) as GeneratedShape | null

  let textBody: string | null = null
  let chartSummary: string | null = null
  let diagramDescription: string | null = null
  let bundleSectionContent: string | null = null

  if (b.kind === 'slide' && b.slideType === 'text' && gen?.body) {
    textBody = gen.body
  } else if (b.kind === 'slide' && b.slideType === 'chart' && gen?.chartType && gen?.data) {
    const dataLine = gen.data
      .map((d) => `${d.label}: ${d.value}`)
      .join(', ')
    chartSummary = `${gen.chartType} chart "${gen.title ?? b.title ?? ''}" — x: ${gen.xLabel ?? ''}, y: ${gen.yLabel ?? ''}; data: ${dataLine}${gen.dataNote ? ` (note: ${gen.dataNote})` : ''}`
  } else if (b.kind === 'slide' && b.slideType === 'diagram') {
    diagramDescription = b.title || b.outline || '(visual diagram, content not extracted)'
  } else if (b.kind === 'bundle_section' && b.bundle && b.sectionKey) {
    const sections = splitByH2(b.bundle.generatedContent)
    const section = sections.find((s) => s.heading === b.sectionKey)
    bundleSectionContent = section ? section.body.trim() : null
  }

  return {
    position: b.position,
    kind: b.kind,
    slideType: b.slideType,
    title: b.title,
    outline: b.outline,
    speakerNotes: b.speakerNotes,
    textBody: textBody ?? bundleSectionContent,
    chartSummary,
    diagramDescription,
    bundleTitle: b.bundle?.title ?? null,
    bundleSectionKey: b.sectionKey ?? null,
    highlightQuote: b.highlight?.anchorText ?? null,
    highlightNote: b.highlight?.note ?? null,
  }
}

export async function POST(
  req: Request,
  { params }: { params: { beatId: string } },
) {
  const { message } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const beat = await prisma.beat.findUnique({
    where: { id: params.beatId },
    include: {
      bundle: { select: { title: true, generatedContent: true } },
      highlight: { select: { anchorText: true, note: true } },
      session: {
        include: {
          course: { select: { name: true } },
          beats: {
            orderBy: { position: 'asc' },
            include: {
              bundle: { select: { title: true, generatedContent: true } },
              highlight: { select: { anchorText: true, note: true } },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!beat) {
    return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
  }

  const currentContext = buildBeatContext(beat)
  const otherContexts = beat.session.beats
    .filter((b) => b.id !== beat.id)
    .map(buildBeatContext)

  const history = beat.messages.map((m) => ({ role: m.role, content: m.content }))

  const assistantMessage = await discussWithBeat(
    beat.session.course.name,
    beat.session.title,
    currentContext,
    otherContexts,
    history,
    message,
  )

  const [, savedAssistant] = await prisma.$transaction([
    prisma.beatMessage.create({
      data: { beatId: beat.id, role: 'user', content: message },
    }),
    prisma.beatMessage.create({
      data: { beatId: beat.id, role: 'assistant', content: assistantMessage },
    }),
  ])

  return NextResponse.json({
    assistantMessage,
    assistantId: savedAssistant.id,
  })
}
