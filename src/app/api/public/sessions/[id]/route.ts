import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      course: { select: { id: true, name: true, description: true } },
      beats: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          kind: true,
          slideType: true,
          title: true,
          generated: true,
          bundleId: true,
          bundle: { select: { id: true, title: true, generatedContent: true, published: true } },
          sectionKey: true,
          highlightId: true,
          highlight: {
            select: { id: true, anchorText: true, color: true, note: true },
          },
          expandedBundle: { select: { id: true, title: true, published: true } },
        },
      },
    },
  })
  if (!session || !session.published) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({
    id: session.id,
    title: session.title,
    description: session.description,
    publishedAt: session.publishedAt,
    course: session.course,
    beats: session.beats,
  })
}
