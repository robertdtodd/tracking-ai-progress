import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const todos = await prisma.todo.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(todos)
}

export async function POST(req: Request) {
  const { text } = await req.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }
  const todo = await prisma.todo.create({ data: { text: text.trim() } })
  return NextResponse.json(todo, { status: 201 })
}
