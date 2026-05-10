import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import StyleEditor from '@/components/StyleEditor'

export const dynamic = 'force-dynamic'

export default async function EditStylePage({
  params,
}: {
  params: { id: string }
}) {
  const style = await prisma.style.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, body: true },
  })
  if (!style) notFound()
  return (
    <StyleEditor
      mode="edit"
      initialId={style.id}
      initialName={style.name}
      initialBody={style.body}
    />
  )
}
