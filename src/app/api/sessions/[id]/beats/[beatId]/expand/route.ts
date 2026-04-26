import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateBundleFromOutline } from '@/lib/claude'

export const maxDuration = 120

export async function POST(
  _req: Request,
  { params }: { params: { id: string; beatId: string } },
) {
  const beat = await prisma.beat.findUnique({
    where: { id: params.beatId },
    include: { session: { include: { course: true } } },
  })
  if (!beat) {
    return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
  }
  if (beat.kind !== 'slide' || beat.slideType !== 'text') {
    return NextResponse.json(
      { error: 'Only text slides can be expanded into bundles' },
      { status: 400 },
    )
  }
  if (!beat.outline || !beat.outline.trim()) {
    return NextResponse.json(
      { error: 'Outline required before expanding' },
      { status: 400 },
    )
  }

  const result = await generateBundleFromOutline(beat.outline, {
    courseName: beat.session.course.name,
    sessionTitle: beat.session.title,
    slideTitle: beat.title ?? undefined,
  })

  const last = await prisma.bundle.findFirst({
    where: { courseId: beat.session.courseId },
    orderBy: { position: 'desc' },
  })
  const position = (last?.position ?? -1) + 1

  const bundle = await prisma.bundle.create({
    data: {
      courseId: beat.session.courseId,
      position,
      title: result.title,
      articleTitles: [],
      themes: [],
      generatedContent: result.content,
    },
  })

  return NextResponse.json({ id: bundle.id, title: bundle.title })
}
