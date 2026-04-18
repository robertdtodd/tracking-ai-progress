import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      bundles: {
        orderBy: { position: 'asc' },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(course)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await prisma.course.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
