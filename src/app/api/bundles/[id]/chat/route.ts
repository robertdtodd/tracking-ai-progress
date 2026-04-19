import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { chatWithBundle } from '@/lib/claude'
import { getAllArticles } from '@/lib/getAllArticles'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { message } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const bundle = await prisma.bundle.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!bundle) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 })
  }

  const history = bundle.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const allArticles = await getAllArticles()

  const { assistantMessage, updatedContent } = await chatWithBundle(
    bundle.course.name,
    bundle.title,
    bundle.generatedContent,
    bundle.articleTitles,
    allArticles,
    history,
    message,
  )

  await prisma.$transaction([
    prisma.message.create({
      data: { bundleId: params.id, role: 'user', content: message },
    }),
    prisma.message.create({
      data: {
        bundleId: params.id,
        role: 'assistant',
        content: assistantMessage,
      },
    }),
    prisma.bundle.update({
      where: { id: params.id },
      data: { generatedContent: updatedContent },
    }),
  ])

  return NextResponse.json({ assistantMessage, updatedContent })
}
