import { prisma } from '@/lib/db'
import NewInsightForm from '@/components/NewInsightForm'

export const dynamic = 'force-dynamic'

export default async function NewInsightPage() {
  const topics = await prisma.topic.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return <NewInsightForm topics={topics} />
}
