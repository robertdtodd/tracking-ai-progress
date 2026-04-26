import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; beatId: string } },
) {
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string' || body.title === null) data.title = body.title
  if (typeof body.outline === 'string' || body.outline === null) data.outline = body.outline
  if (typeof body.slideType === 'string') {
    if (!['text', 'diagram', 'chart'].includes(body.slideType)) {
      return NextResponse.json({ error: 'Invalid slideType' }, { status: 400 })
    }
    const existing = await prisma.beat.findUnique({ where: { id: params.beatId } })
    if (existing && existing.slideType !== body.slideType) {
      data.slideType = body.slideType
      // Generated payload is type-specific (html for diagram, body for text); clear when switching.
      data.generated = null as unknown as Parameters<typeof prisma.beat.update>[0]['data']['generated']
      data.generatedAt = null
    }
  }
  if (typeof body.sectionKey === 'string' || body.sectionKey === null) {
    data.sectionKey = body.sectionKey
  }
  if (typeof body.bundleId === 'string' || body.bundleId === null) data.bundleId = body.bundleId
  if (typeof body.highlightId === 'string' || body.highlightId === null) {
    data.highlightId = body.highlightId
  }
  if (typeof body.speakerNotes === 'string' || body.speakerNotes === null) {
    data.speakerNotes = body.speakerNotes
  }
  if (body.generated !== undefined) {
    data.generated = body.generated
    data.generatedAt = body.generated ? new Date() : null
  }

  const beat = await prisma.beat.update({
    where: { id: params.beatId },
    data,
    include: {
      bundle: { select: { id: true, title: true, generatedContent: true } },
      highlight: {
        select: { id: true, anchorText: true, color: true, note: true, bundleId: true },
      },
      expandedBundle: { select: { id: true, title: true } },
    },
  })
  return NextResponse.json(beat)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { beatId: string } },
) {
  await prisma.beat.delete({ where: { id: params.beatId } })
  return NextResponse.json({ ok: true })
}
