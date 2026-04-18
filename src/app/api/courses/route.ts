import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bundles: true } } },
  })
  return NextResponse.json(courses)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }
  const course = await prisma.course.create({
    data: { name: name.trim() },
  })
  return NextResponse.json(course)
}
