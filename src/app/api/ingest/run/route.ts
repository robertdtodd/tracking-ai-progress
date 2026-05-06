import { NextResponse } from 'next/server'
import { runIngest } from '@/lib/ingest/run'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const topicName = url.searchParams.get('topic') ?? undefined
  const skipEmbeddings = url.searchParams.get('skipEmbeddings') === '1'
  const skipSummaries = url.searchParams.get('skipSummaries') === '1'

  try {
    const stats = await runIngest({ topicName, skipEmbeddings, skipSummaries })
    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
