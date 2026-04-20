import { prisma } from '@/lib/db'
import { fetchNytAIArticles } from '@/lib/ingest/nyt'
import { fetchGuardianAIArticles } from '@/lib/ingest/guardian'
import { classifyArticle } from '@/lib/ingest/classify'
import type { NormalizedArticle } from '@/lib/ingest/types'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

type Stats = {
  inserted: number
  skippedExisting: number
  skippedIrrelevant: number
  errored: number
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message === 'Aborted')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { from, to, sources } = body as {
    from?: string
    to?: string
    sources?: string[]
  }

  if (!from || !to) {
    return new Response(JSON.stringify({ error: 'from and to required (YYYY-MM-DD)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!sources || sources.length === 0) {
    return new Response(JSON.stringify({ error: 'at least one source required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const abortController = new AbortController()
  const encoder = new TextEncoder()

  req.signal.addEventListener('abort', () => abortController.abort())

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      function send(event: unknown) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          closed = true
        }
      }

      const stats: Stats = { inserted: 0, skippedExisting: 0, skippedIrrelevant: 0, errored: 0 }
      const sendStats = () => send({ type: 'stats', ...stats })

      async function processArticle(a: NormalizedArticle, label: string, current: number, total: number) {
        if (abortController.signal.aborted) return
        if (!a.sourceId || !a.title) {
          stats.errored++
          return
        }
        const existing = await prisma.userArticle.findFirst({
          where: { source: a.source, sourceId: a.sourceId },
        })
        if (existing) {
          stats.skippedExisting++
          return
        }
        try {
          const cls = await classifyArticle(a.title, a.description)
          if (!cls.relevant) {
            stats.skippedIrrelevant++
            return
          }
          await prisma.userArticle.create({
            data: {
              source: a.source,
              sourceId: a.sourceId,
              title: a.title,
              author: a.author,
              date: a.date,
              section: a.section,
              description: a.description,
              url: a.url,
              themes: cls.themes,
            },
          })
          stats.inserted++
          send({ type: 'log', message: `[${label} ${current}/${total}] + ${a.date} ${a.title.slice(0, 70)}` })
        } catch (err) {
          if (isAbortError(err)) throw err
          stats.errored++
          send({ type: 'log', message: `[${label} ${current}/${total}] ERROR: ${(err as Error).message}` })
        }
      }

      async function runSource(source: string) {
        if (abortController.signal.aborted) return
        if (source === 'nyt') {
          send({ type: 'log', message: `=== NYT: ${from} → ${to} ===` })
          const articles = await fetchNytAIArticles({
            beginDate: from!,
            endDate: to!,
            signal: abortController.signal,
            onProgress: (m) => send({ type: 'log', message: m }),
          })
          send({ type: 'log', message: `NYT fetched ${articles.length}. Classifying + persisting…` })
          for (let i = 0; i < articles.length; i++) {
            if (abortController.signal.aborted) break
            await processArticle(articles[i], 'NYT', i + 1, articles.length)
            if ((i + 1) % 5 === 0 || i === articles.length - 1) sendStats()
          }
        }
        if (source === 'guardian') {
          send({ type: 'log', message: `=== Guardian: ${from} → ${to} ===` })
          const articles = await fetchGuardianAIArticles({
            beginDate: from!,
            endDate: to!,
            signal: abortController.signal,
            onProgress: (m) => send({ type: 'log', message: m }),
          })
          send({ type: 'log', message: `Guardian fetched ${articles.length}. Classifying + persisting…` })
          for (let i = 0; i < articles.length; i++) {
            if (abortController.signal.aborted) break
            await processArticle(articles[i], 'Guardian', i + 1, articles.length)
            if ((i + 1) % 5 === 0 || i === articles.length - 1) sendStats()
          }
        }
      }

      try {
        send({ type: 'log', message: `Starting import for [${sources!.join(', ')}], ${from} → ${to}` })
        for (const s of sources!) {
          if (abortController.signal.aborted) break
          await runSource(s)
        }
        if (abortController.signal.aborted) {
          sendStats()
          send({ type: 'cancelled', ...stats })
        } else {
          sendStats()
          send({ type: 'done', ...stats })
        }
      } catch (err) {
        sendStats()
        if (isAbortError(err) || abortController.signal.aborted) {
          send({ type: 'cancelled', ...stats })
        } else {
          send({ type: 'error', message: (err as Error).message, ...stats })
        }
      } finally {
        closed = true
        try {
          controller.close()
        } catch {}
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
