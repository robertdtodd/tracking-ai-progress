import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  generateChartSlide,
  generateDiagram,
  generateTextSlide,
  type PriorSequenceBeat,
} from '@/lib/claude'
import { getAllArticles } from '@/lib/getAllArticles'

export const maxDuration = 120

type GeneratedJson = {
  body?: string
  html?: string
  title?: string
  chartType?: string
  data?: unknown
}

function extractPriorBody(slideType: string | null, gen: GeneratedJson | null): string | null {
  if (!gen) return null
  if (slideType === 'text' && typeof gen.body === 'string') return gen.body
  if (slideType === 'chart' && gen.chartType) {
    const dataLine = Array.isArray(gen.data)
      ? (gen.data as Array<{ label: string; value: number }>)
          .map((d) => `${d.label}: ${d.value}`)
          .join(', ')
      : ''
    return `${gen.chartType} chart "${gen.title ?? ''}": ${dataLine}`
  }
  if (slideType === 'diagram') {
    return '(diagram — visual content not transcribable)'
  }
  return null
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string; beatId: string } },
) {
  const beat = await prisma.beat.findUnique({
    where: { id: params.beatId },
    include: {
      session: { include: { course: true } },
      bundle: true,
    },
  })
  if (!beat) {
    return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
  }
  if (beat.kind !== 'slide') {
    return NextResponse.json(
      { error: 'Only slide beats can be generated' },
      { status: 400 },
    )
  }
  if (!beat.outline || !beat.outline.trim()) {
    return NextResponse.json(
      { error: 'Outline required before generating' },
      { status: 400 },
    )
  }

  let priorBeats: PriorSequenceBeat[] = []
  if (beat.sequenceId) {
    const earlier = await prisma.beat.findMany({
      where: {
        sessionId: beat.sessionId,
        sequenceId: beat.sequenceId,
        position: { lt: beat.position },
      },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        title: true,
        outline: true,
        slideType: true,
        generated: true,
      },
    })
    priorBeats = earlier
      .map((b) => ({
        position: b.position,
        title: b.title,
        outline: b.outline,
        body: extractPriorBody(b.slideType, b.generated as GeneratedJson | null),
      }))
      .filter((b) => b.outline !== null || b.body !== null)
  }

  let generated: unknown
  let resolvedTitle: string | null = beat.title

  if (beat.slideType === 'diagram') {
    const html = await generateDiagram(beat.outline, priorBeats)
    generated = { html }
  } else if (beat.slideType === 'text') {
    const allArticles = beat.bundle ? await getAllArticles() : undefined
    const result = await generateTextSlide(beat.outline, {
      courseName: beat.session.course.name,
      sessionTitle: beat.session.title,
      bundleTitle: beat.bundle?.title,
      bundleContent: beat.bundle?.generatedContent,
      articleTitles: beat.bundle?.articleTitles,
      allArticles,
      priorBeats,
    })
    generated = { body: result.body }
    if (!resolvedTitle && result.title) resolvedTitle = result.title
    // Only overwrite speakerNotes if the user hasn't written their own.
    if (!beat.speakerNotes && result.speakerNotes) {
      await prisma.beat.update({
        where: { id: beat.id },
        data: { speakerNotes: result.speakerNotes },
      })
    }
  } else if (beat.slideType === 'chart') {
    const allArticles = beat.bundle ? await getAllArticles() : undefined
    const result = await generateChartSlide(beat.outline, {
      courseName: beat.session.course.name,
      sessionTitle: beat.session.title,
      bundleTitle: beat.bundle?.title,
      bundleContent: beat.bundle?.generatedContent,
      articleTitles: beat.bundle?.articleTitles,
      allArticles,
      priorBeats,
    })
    generated = {
      chartType: result.chartType,
      title: result.title,
      xLabel: result.xLabel,
      yLabel: result.yLabel,
      data: result.data,
      dataNote: result.dataNote ?? null,
    }
    if (!resolvedTitle && result.title) resolvedTitle = result.title
    if (!beat.speakerNotes && result.speakerNotes) {
      await prisma.beat.update({
        where: { id: beat.id },
        data: { speakerNotes: result.speakerNotes },
      })
    }
  } else {
    return NextResponse.json({ error: 'Unknown slideType' }, { status: 400 })
  }

  const updated = await prisma.beat.update({
    where: { id: beat.id },
    data: {
      generated: generated as Parameters<typeof prisma.beat.update>[0]['data']['generated'],
      generatedAt: new Date(),
      title: resolvedTitle,
    },
    include: {
      bundle: { select: { id: true, title: true, generatedContent: true } },
      highlight: {
        select: { id: true, anchorText: true, color: true, note: true, bundleId: true },
      },
      expandedBundle: { select: { id: true, title: true } },
    },
  })
  return NextResponse.json(updated)
}
