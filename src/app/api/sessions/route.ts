import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { courseId, title, description } = await req.json()
  if (!courseId || typeof courseId !== 'string') {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const last = await prisma.session.findFirst({
    where: { courseId },
    orderBy: { position: 'desc' },
  })
  const position = (last?.position ?? -1) + 1

  const finalTitle =
    (typeof title === 'string' && title.trim()) || `Session ${position + 1}`

  const session = await prisma.session.create({
    data: {
      courseId,
      position,
      title: finalTitle,
      description: typeof description === 'string' ? description : null,
    },
  })
  return NextResponse.json(session)
}
