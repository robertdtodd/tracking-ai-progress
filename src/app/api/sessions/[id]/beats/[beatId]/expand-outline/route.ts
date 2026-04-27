import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { expandOutlineWithSearch } from '@/lib/claude'

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
  if (beat.kind !== 'slide') {
    return NextResponse.json(
      { error: 'Only slide beats can have their outline expanded' },
      { status: 400 },
    )
  }
  if (!beat.outline || !beat.outline.trim()) {
    return NextResponse.json(
      { error: 'Outline required before expanding' },
      { status: 400 },
    )
  }

  const expanded = await expandOutlineWithSearch(beat.outline, {
    courseName: beat.session.course.name,
    sessionTitle: beat.session.title,
    slideType: (beat.slideType ?? 'text') as 'text' | 'diagram' | 'chart',
  })

  return NextResponse.json({ outline: expanded })
}
