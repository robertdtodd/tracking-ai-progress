import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_STANCES = ['open_question', 'working_hypothesis', 'current_claim'] as const
const BODY_FIELDS = ['bottomLine', 'rationale', 'openQuestions'] as const

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.title === 'string' && body.title.trim()) {
    data.title = body.title.trim()
  }
  if (typeof body.stance === 'string') {
    if (!VALID_STANCES.includes(body.stance)) {
      return NextResponse.json({ error: 'invalid stance' }, { status: 400 })
    }
    data.stance = body.stance
  }
  for (const field of BODY_FIELDS) {
    if (typeof body[field] === 'string') {
      data[field] = body[field]
    }
  }

  if (Array.isArray(body.topicIds)) {
    await prisma.$transaction([
      prisma.insightTopic.deleteMany({ where: { insightId: params.id } }),
      ...body.topicIds.map((topicId: string) =>
        prisma.insightTopic.create({ data: { insightId: params.id, topicId } }),
      ),
    ])
  }

  if (Object.keys(data).length > 0) {
    await prisma.insight.update({ where: { id: params.id }, data })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.insight.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 })
  }
}
