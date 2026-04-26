import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_KINDS = ['slide', 'bundle_section', 'highlight_quote', 'section_header']
const VALID_SLIDE_TYPES = ['text', 'diagram', 'chart']

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json()
  const kind = body.kind
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  const session = await prisma.session.findUnique({ where: { id: params.id } })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const last = await prisma.beat.findFirst({
    where: { sessionId: params.id },
    orderBy: { position: 'desc' },
  })
  const position = (last?.position ?? -1) + 1

  const data: Record<string, unknown> = {
    sessionId: params.id,
    position,
    kind,
  }

  if (kind === 'slide') {
    const slideType = body.slideType
    if (!VALID_SLIDE_TYPES.includes(slideType)) {
      return NextResponse.json({ error: 'Invalid slideType' }, { status: 400 })
    }
    data.slideType = slideType
    data.title = typeof body.title === 'string' ? body.title : null
    data.outline = typeof body.outline === 'string' ? body.outline : null
    data.bundleId = typeof body.bundleId === 'string' ? body.bundleId : null
  } else if (kind === 'bundle_section') {
    if (typeof body.bundleId !== 'string') {
      return NextResponse.json({ error: 'bundleId required' }, { status: 400 })
    }
    data.bundleId = body.bundleId
    data.sectionKey = typeof body.sectionKey === 'string' ? body.sectionKey : null
  } else if (kind === 'highlight_quote') {
    if (typeof body.highlightId !== 'string') {
      return NextResponse.json({ error: 'highlightId required' }, { status: 400 })
    }
    data.highlightId = body.highlightId
  } else if (kind === 'section_header') {
    data.title = typeof body.title === 'string' ? body.title : ''
  }

  const beat = await prisma.beat.create({
    data: data as Parameters<typeof prisma.beat.create>[0]['data'],
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
