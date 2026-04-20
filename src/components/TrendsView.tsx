'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as Plot from '@observablehq/plot'

type Point = {
  week: string
  theme: string
  count: number
  subtopics: Record<string, number>
}

type TrendsResponse = {
  points: Point[]
  themes: string[]
  themeTotals: Record<string, number>
  weeks: string[]
  totalArticles: number
}

const THEME_COLORS: Record<string, string> = {
  'Anthropic & Mythos': '#c084fc',
  'Anthropic vs Pentagon': '#a855f7',
  OpenAI: '#22d3ee',
  'AI Industry & Models': '#0ea5e9',
  'Cybersecurity & Defense': '#dc2626',
  'War & Military': '#991b1b',
  'China & Geopolitics': '#f97316',
  'Politics & Elections': '#ef4444',
  'Legal & Regulation': '#fbbf24',
  'Jobs & Labor': '#10b981',
  'Business & Economy': '#059669',
  'Data Centers & Energy': '#84cc16',
  'AI Safety & Risks': '#8b5cf6',
  'AI Misuse & Slop': '#d946ef',
  'Companions & Relationships': '#ec4899',
  'Health & Medicine': '#06b6d4',
  Education: '#14b8a6',
  'Arts & Creative': '#f59e0b',
  'Society & Culture': '#eab308',
  'Daily Life & Tools': '#6366f1',
}

const FALLBACK_PALETTE = [
  '#94a3b8',
  '#64748b',
  '#78716c',
  '#a3a3a3',
  '#737373',
]

function colorFor(theme: string, idx: number): string {
  return THEME_COLORS[theme] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length]
}

function fmtWeek(w: string): string {
  const d = new Date(w + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function TrendsView() {
  const [data, setData] = useState<TrendsResponse | null>(null)
  const [sourcesFilter, setSourcesFilter] = useState<Set<string>>(new Set(['nyt', 'guardian', 'user']))
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ sources: Array.from(sourcesFilter).join(',') })
    fetch(`/api/trends?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [sourcesFilter])

  const themeOrder = useMemo(() => {
    if (!data) return []
    return [...data.themes].sort(
      (a, b) => (data.themeTotals[b] || 0) - (data.themeTotals[a] || 0),
    )
  }, [data])

  useEffect(() => {
    if (!chartRef.current || !data || data.points.length === 0) return

    const container = chartRef.current
    container.innerHTML = ''

    const width = container.clientWidth
    const height = container.clientHeight

    const fmtTooltip = (p: Point) => {
      const date = new Date(p.week + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
      const lines = [
        p.theme,
        `Week of ${date}`,
        `${p.count} article${p.count === 1 ? '' : 's'}`,
      ]
      const subs = Object.entries(p.subtopics).sort((a, b) => b[1] - a[1])
      if (subs.length > 0) {
        lines.push('')
        lines.push('Sub-topics:')
        for (const [name, c] of subs) {
          lines.push(`  · ${name} (${c})`)
        }
      }
      return lines.join('\n')
    }

    const enriched = data.points.map((p) => ({
      ...p,
      _tooltip: fmtTooltip(p),
      opacity: hoveredTheme ? (p.theme === hoveredTheme ? 1 : 0.18) : 0.92,
    }))

    const years = new Set(data.weeks.map((w) => w.slice(0, 4)))
    const spansMultipleYears = years.size > 1
    const tickFormat = (d: Date) =>
      spansMultipleYears
        ? d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          })

    const chart = Plot.plot({
      width,
      height,
      marginLeft: 60,
      marginRight: 24,
      marginTop: 30,
      marginBottom: 50,
      x: {
        type: 'utc',
        label: null,
        tickFormat,
      },
      y: {
        label: 'Articles per week →',
        labelAnchor: 'center',
        grid: true,
      },
      color: {
        type: 'categorical',
        domain: themeOrder,
        range: themeOrder.map((t, i) => colorFor(t, i)),
        legend: false,
      },
      marks: [
        Plot.areaY(
          enriched.map((p) => ({ ...p, week: new Date(p.week + 'T00:00:00Z') })),
          {
            x: 'week',
            y: 'count',
            z: 'theme',
            fill: 'theme',
            curve: 'catmull-rom',
            fillOpacity: (d: any) => d.opacity ?? 0.92,
            order: themeOrder,
            stroke: 'white',
            strokeWidth: 0.3,
            title: '_tooltip',
            tip: {
              format: {
                title: true,
                fill: null,
                x: null,
                y: null,
                z: null,
              },
            },
          },
        ),
        Plot.ruleY([0]),
      ],
      style: {
        background: 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: '11px',
        color: 'var(--text-secondary)',
      },
    })

    container.appendChild(chart)

    return () => {
      chart.remove()
    }
  }, [data, themeOrder, hoveredTheme])

  function toggleSource(s: string) {
    setSourcesFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const maxTotal = useMemo(() => {
    if (!data) return 0
    return Math.max(0, ...Object.values(data.themeTotals))
  }, [data])

  return (
    <div className="trends-view">
      <header className="trends-header">
        <div>
          <h1>Thematic trends</h1>
          <div className="trends-sub">
            {data
              ? `${data.totalArticles.toLocaleString()} articles · ${data.weeks.length} weeks · ${themeOrder.length} themes`
              : 'Loading…'}
          </div>
        </div>
        <div className="trends-controls">
          <div className="trends-source-toggle">
            <label>
              <input
                type="checkbox"
                checked={sourcesFilter.has('nyt')}
                onChange={() => toggleSource('nyt')}
              />
              NYT
            </label>
            <label>
              <input
                type="checkbox"
                checked={sourcesFilter.has('guardian')}
                onChange={() => toggleSource('guardian')}
              />
              Guardian
            </label>
          </div>
          <Link className="trends-back" href="/">
            ← Back to editor
          </Link>
        </div>
      </header>

      <div className="trends-body">
        <div className="trends-chart" ref={chartRef}>
          {loading && <div className="trends-loading">Loading…</div>}
          {!loading && data && data.points.length === 0 && (
            <div className="trends-loading">No articles in range.</div>
          )}
        </div>

        <aside className="trends-legend">
          <div className="trends-legend-title">Themes (by total count)</div>
          <div className="trends-legend-list">
            {data &&
              themeOrder.map((theme, i) => {
                const total = data.themeTotals[theme] || 0
                const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
                const color = colorFor(theme, i)
                const isHovered = hoveredTheme === theme
                return (
                  <div
                    key={theme}
                    className={`trends-legend-row${isHovered ? ' active' : ''}`}
                    onMouseEnter={() => setHoveredTheme(theme)}
                    onMouseLeave={() => setHoveredTheme(null)}
                  >
                    <span
                      className="trends-legend-swatch"
                      style={{ background: color }}
                    />
                    <span className="trends-legend-name">{theme}</span>
                    <span className="trends-legend-bar">
                      <span
                        className="trends-legend-bar-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </span>
                    <span className="trends-legend-count">{total}</span>
                  </div>
                )
              })}
          </div>
        </aside>
      </div>
    </div>
  )
}
