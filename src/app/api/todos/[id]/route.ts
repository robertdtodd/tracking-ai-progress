import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const todo = await prisma.todo.update({
    where: { id: params.id },
    data: {
      ...(body.text !== undefined && { text: body.text }),
      ...(body.done !== undefined && { done: body.done }),
    },
  })
  return NextResponse.json(todo)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.todo.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
