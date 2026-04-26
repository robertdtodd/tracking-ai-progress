import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          bundles: {
            orderBy: { position: 'asc' },
            include: { highlights: { orderBy: { position: 'asc' } } },
          },
        },
      },
      beats: {
        orderBy: { position: 'asc' },
        include: {
          bundle: { select: { id: true, title: true, generatedContent: true } },
          highlight: {
            select: { id: true, anchorText: true, color: true, note: true, bundleId: true },
          },
          expandedBundle: { select: { id: true, title: true } },
        },
      },
    },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  return NextResponse.json(session)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.trim() || 'Untitled'
  if (typeof body.description === 'string' || body.description === null) {
    data.description = body.description ?? null
  }
  if (typeof body.published === 'boolean') {
    data.published = body.published
    data.publishedAt = body.published ? new Date() : null
  }
  const session = await prisma.session.update({
    where: { id: params.id },
    data,
  })
  return NextResponse.json(session)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await prisma.session.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
