import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_COLORS = new Set(['yellow', 'red', 'blue', 'green'])

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { anchorText, color, note } = await req.json()
  if (!anchorText || typeof anchorText !== 'string' || !anchorText.trim()) {
    return NextResponse.json({ error: 'anchorText required' }, { status: 400 })
  }
  const c = VALID_COLORS.has(color) ? color : 'yellow'

  const count = await prisma.highlight.count({ where: { bundleId: params.id } })

  const h = await prisma.highlight.create({
    data: {
      bundleId: params.id,
      anchorText: anchorText.trim(),
      color: c,
      note: note?.trim() || null,
      position: count,
    },
  })

  return NextResponse.json(h)
}
