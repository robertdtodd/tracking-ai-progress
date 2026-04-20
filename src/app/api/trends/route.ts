import { NextResponse } from 'next/server'
import { getAllArticles } from '@/lib/getAllArticles'

export const dynamic = 'force-dynamic'

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) return dateStr
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sourceParam = url.searchParams.get('sources')
  const sourceFilter = sourceParam
    ? new Set(sourceParam.split(',').map((s) => s.trim()).filter(Boolean))
    : null

  const articles = await getAllArticles()

  const counts: Map<string, Map<string, number>> = new Map()
  const subtopicCounts: Map<string, Map<string, Map<string, number>>> = new Map()
  const themeTotals: Map<string, number> = new Map()
  const weeks: Set<string> = new Set()

  for (const a of articles) {
    if (sourceFilter && !sourceFilter.has(a.source ?? 'user')) continue
    if (!a.d) continue
    const week = weekStart(a.d)
    weeks.add(week)
    const themesForArticle = Object.entries(a.th || {})
    if (themesForArticle.length === 0) continue
    if (!counts.has(week)) counts.set(week, new Map())
    if (!subtopicCounts.has(week)) subtopicCounts.set(week, new Map())
    const wmap = counts.get(week)!
    const wsub = subtopicCounts.get(week)!
    for (const [theme, subs] of themesForArticle) {
      wmap.set(theme, (wmap.get(theme) || 0) + 1)
      themeTotals.set(theme, (themeTotals.get(theme) || 0) + 1)
      if (Array.isArray(subs) && subs.length > 0) {
        if (!wsub.has(theme)) wsub.set(theme, new Map())
        const sm = wsub.get(theme)!
        for (const s of subs) {
          sm.set(s, (sm.get(s) || 0) + 1)
        }
      }
    }
  }

  const allThemes = Array.from(themeTotals.keys()).sort(
    (a, b) => (themeTotals.get(b) || 0) - (themeTotals.get(a) || 0),
  )
  const allWeeks = Array.from(weeks).sort()

  const points: {
    week: string
    theme: string
    count: number
    subtopics: Record<string, number>
  }[] = []
  for (const week of allWeeks) {
    const wmap = counts.get(week) || new Map()
    const wsub = subtopicCounts.get(week) || new Map()
    for (const theme of allThemes) {
      const subMap = wsub.get(theme)
      points.push({
        week,
        theme,
        count: wmap.get(theme) || 0,
        subtopics: subMap ? Object.fromEntries(subMap) : {},
      })
    }
  }

  return NextResponse.json({
    points,
    themes: allThemes,
    themeTotals: Object.fromEntries(themeTotals),
    weeks: allWeeks,
    totalArticles: articles.filter(
      (a) => !sourceFilter || sourceFilter.has(a.source ?? 'user'),
    ).length,
  })
}
