import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_COLORS = new Set(['yellow', 'red', 'blue', 'green'])

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json()
  const data: { color?: string; note?: string | null } = {}

  if (typeof body.color === 'string') {
    if (!VALID_COLORS.has(body.color)) {
      return NextResponse.json({ error: 'invalid color' }, { status: 400 })
    }
    data.color = body.color
  }
  if (Object.prototype.hasOwnProperty.call(body, 'note')) {
    data.note = body.note?.toString().trim() || null
  }

  const h = await prisma.highlight.update({
    where: { id: params.id },
    data,
  })
  return NextResponse.json(h)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await prisma.highlight.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
