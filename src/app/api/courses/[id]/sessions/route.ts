import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const sessions = await prisma.session.findMany({
    where: { courseId: params.id },
    orderBy: { position: 'asc' },
    include: { _count: { select: { beats: true } } },
  })
  return NextResponse.json(sessions)
}
