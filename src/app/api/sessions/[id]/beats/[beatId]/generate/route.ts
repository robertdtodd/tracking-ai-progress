import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateChartSlide, generateDiagram, generateTextSlide } from '@/lib/claude'
import { getAllArticles } from '@/lib/getAllArticles'

export const maxDuration = 120

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

  let generated: unknown
  let resolvedTitle: string | null = beat.title

  if (beat.slideType === 'diagram') {
    const html = await generateDiagram(beat.outline)
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
