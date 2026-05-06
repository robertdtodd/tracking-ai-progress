import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_STANCES = ['open_question', 'working_hypothesis', 'current_claim'] as const

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || 'insight'
  let n = 1
  while (await prisma.insight.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { title, stance = 'working_hypothesis', topicIds = [] } = body as {
    title?: string
    stance?: string
    topicIds?: string[]
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }
  if (!VALID_STANCES.includes(stance as (typeof VALID_STANCES)[number])) {
    return NextResponse.json({ error: 'invalid stance' }, { status: 400 })
  }

  const slug = await uniqueSlug(slugify(title.trim()))

  const insight = await prisma.insight.create({
    data: {
      title: title.trim(),
      slug,
      stance,
      topics: topicIds.length
        ? { create: topicIds.map((topicId) => ({ topicId })) }
        : undefined,
    },
    select: { id: true, slug: true },
  })

  return NextResponse.json(insight)
}
