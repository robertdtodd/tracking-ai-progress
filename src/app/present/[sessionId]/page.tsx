import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import Presenter from '@/components/Presenter'

export const dynamic = 'force-dynamic'

export default async function PresentPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: {
      course: { select: { id: true, name: true } },
      beats: {
        orderBy: { position: 'asc' },
        include: {
          bundle: { select: { id: true, title: true, generatedContent: true } },
          highlight: {
            select: {
              id: true,
              anchorText: true,
              color: true,
              note: true,
              bundleId: true,
            },
          },
        },
      },
    },
  })

  if (!session) notFound()

  return <Presenter session={JSON.parse(JSON.stringify(session))} />
}
