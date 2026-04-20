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
          highlights: { orderBy: { position: 'asc' } },
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json()
  const data: { name?: string; description?: string | null } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    data.description = body.description?.toString().trim() || null
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }
  const course = await prisma.course.update({ where: { id: params.id }, data })
  return NextResponse.json(course)
}
