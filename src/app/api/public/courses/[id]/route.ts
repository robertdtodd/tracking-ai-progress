import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      bundles: {
        where: { published: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          title: true,
          articleTitles: true,
          themes: true,
          publishedAt: true,
        },
      },
      sessions: {
        where: { published: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          title: true,
          description: true,
          publishedAt: true,
          _count: { select: { beats: true } },
        },
      },
    },
  })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    id: course.id,
    name: course.name,
    description: course.description,
    bundles: course.bundles,
    sessions: course.sessions,
  })
}
