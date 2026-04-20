'use client'

import { useEffect, useMemo, useState } from 'react'
import { themeConfig, Article } from '@/lib/articles'
import ImportArticlesForm from './ImportArticlesForm'

interface Props {
  selectedTitles: Set<string>
  onToggle: (title: string) => void
  onSelectMany: (titles: string[]) => void
  onClearSelection: () => void
  activeCourseId: string | null
  onBundleCreated: () => void
  onCollapse: () => void
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function fmtDate(s: string) {
  const [, m, d] = s.split('-').map(Number)
  return `${MONTHS_SHORT[m - 1]} ${d}`
}
function fmtDateLong(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAYS[dt.getDay()]}, ${MONTHS_LONG[m - 1]} ${d}, ${y}`
}

export default function ArticleBrowser({
  selectedTitles,
  onToggle,
  onSelectMany,
  onClearSelection,
  activeCourseId,
  onBundleCreated,
  onCollapse,
}: Props) {
  const [userArticles, setUserArticles] = useState<Article[]>([])
  const [view, setView] = useState('chrono')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeThemes, setActiveThemes] = useState<Set<string>>(new Set())
  const [activeSubs, setActiveSubs] = useState<Set<string>>(new Set())
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [bundleTitle, setBundleTitle] = useState('')
  const [showImport, setShowImport] = useState(false)

  function refreshUserArticles() {
    return fetch('/api/articles')
      .then((r) => (r.ok ? r.json() : []))
      .then(setUserArticles)
      .catch(() => {})
  }

  useEffect(() => {
    refreshUserArticles()
  }, [])

  useEffect(() => {
    if (!generating) {
      setElapsedSec(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [generating])

  const fmtElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const allArticles = userArticles

  const { themeCounts, subCounts } = useMemo(() => {
    const tc: Record<string, number> = {}
    const sc: Record<string, number> = {}
    themeConfig.forEach((t) => (tc[t.name] = 0))
    allArticles.forEach((a) => {
      Object.entries(a.th).forEach(([theme, subs]) => {
        tc[theme] = (tc[theme] || 0) + 1
        subs.forEach((sub) => {
          const k = theme + '||' + sub
          sc[k] = (sc[k] || 0) + 1
        })
      })
    })
    return { themeCounts: tc, subCounts: sc }
  }, [allArticles])

  const filtered = useMemo(() => {
    return allArticles.filter((a) => {
      if (search) {
        const q = search.toLowerCase()
        const hay = (a.t + ' ' + (a.by || '') + ' ' + a.sec).toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (startDate && a.d < startDate) return false
      if (endDate && a.d > endDate) return false
      const hasSub = activeSubs.size > 0
      const hasTheme = activeThemes.size > 0
      if (!hasSub && !hasTheme) return true

      const themesWithActiveSub = new Set<string>()
      activeSubs.forEach((k) => themesWithActiveSub.add(k.split('||')[0]))

      for (const [theme, subs] of Object.entries(a.th)) {
        if (hasSub && themesWithActiveSub.has(theme)) {
          for (const s of subs) {
            if (activeSubs.has(theme + '||' + s)) return true
          }
        }
        if (hasTheme && activeThemes.has(theme) && !themesWithActiveSub.has(theme)) {
          return true
        }
      }
      return false
    })
  }, [allArticles, search, startDate, endDate, activeThemes, activeSubs])

  const derivedThemes = useMemo(() => {
    const set = new Set<string>()
    allArticles
      .filter((a) => selectedTitles.has(a.t))
      .forEach((a) => Object.keys(a.th).forEach((t) => set.add(t)))
    return Array.from(set)
  }, [selectedTitles, allArticles])

  async function handleGenerateBundle() {
    if (!activeCourseId || selectedTitles.size === 0) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/courses/${activeCourseId}/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleTitles: Array.from(selectedTitles),
          themes: derivedThemes,
          bundleTitle: bundleTitle.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed: ' + (err.error || res.statusText))
        return
      }
      setBundleTitle('')
      onBundleCreated()
    } finally {
      setGenerating(false)
    }
  }

  function toggleTheme(t: string) {
    setActiveThemes((prev) => {
      const n = new Set(prev)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })
  }
  function toggleSub(k: string) {
    setActiveSubs((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }
  function toggleExpanded(t: string) {
    setExpandedThemes((prev) => {
      const n = new Set(prev)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })
  }

  function renderArticleRow(a: Article) {
    const checked = selectedTitles.has(a.t)
    return (
      <div className="article-item" key={a.t + a.d}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(a.t)}
        />
        <div className="article-date">{fmtDate(a.d)}</div>
        <div>
          <div className="article-title">{a.t}</div>
          {a.by && <div className="article-byline">{a.by}</div>}
        </div>
        <div className="article-section">{a.sec}</div>
      </div>
    )
  }

  function renderList() {
    if (filtered.length === 0) {
      return <div className="empty">No articles match your filters.</div>
    }

    if (view === 'chrono' || view === 'chrono-asc') {
      const sorted = [...filtered].sort((a, b) =>
        view === 'chrono' ? b.d.localeCompare(a.d) : a.d.localeCompare(b.d),
      )
      const chunks: React.ReactElement[] = []
      let currentDate: string | null = null
      sorted.forEach((a) => {
        if (a.d !== currentDate) {
          currentDate = a.d
          chunks.push(
            <div className="day-header" key={`day-${a.d}`}>
              {fmtDateLong(a.d)}
            </div>,
          )
        }
        chunks.push(renderArticleRow(a))
      })
      return chunks
    }

    if (view === 'theme') {
      const chunks: React.ReactElement[] = []
      themeConfig.forEach((tc) => {
        const inTheme = filtered.filter((a) => a.th[tc.name] !== undefined)
        if (inTheme.length === 0) return
        chunks.push(
          <div className="theme-header" key={`th-${tc.name}`}>
            {tc.name} <span className="ct">{inTheme.length} articles</span>
          </div>,
        )
        if (tc.subs.length === 0) {
          ;[...inTheme]
            .sort((a, b) => b.d.localeCompare(a.d))
            .forEach((a) => chunks.push(renderArticleRow(a)))
        } else {
          const bySub: Record<string, Article[]> = {}
          const noSub: Article[] = []
          tc.subs.forEach((s) => (bySub[s] = []))
          inTheme.forEach((a) => {
            const subs = a.th[tc.name] || []
            if (subs.length === 0) {
              noSub.push(a)
              return
            }
            subs.forEach((s) => {
              if (bySub[s]) bySub[s].push(a)
              else noSub.push(a)
            })
          })
          tc.subs.forEach((s) => {
            if (bySub[s].length === 0) return
            chunks.push(
              <div className="subtheme-header" key={`st-${tc.name}-${s}`}>
                {s} <span className="ct">{bySub[s].length}</span>
              </div>,
            )
            ;[...bySub[s]]
              .sort((a, b) => b.d.localeCompare(a.d))
              .forEach((a) => chunks.push(renderArticleRow(a)))
          })
          if (noSub.length > 0) {
            chunks.push(
              <div className="subtheme-header" key={`st-${tc.name}-other`}>
                Other <span className="ct">{noSub.length}</span>
              </div>,
            )
            ;[...noSub]
              .sort((a, b) => b.d.localeCompare(a.d))
              .forEach((a) => chunks.push(renderArticleRow(a)))
          }
        }
      })
      return chunks
    }

    if (view === 'section') {
      const groups: Record<string, Article[]> = {}
      filtered.forEach((a) => {
        if (!groups[a.sec]) groups[a.sec] = []
        groups[a.sec].push(a)
      })
      const chunks: React.ReactElement[] = []
      Object.keys(groups)
        .sort((a, b) => groups[b].length - groups[a].length)
        .forEach((sec) => {
          chunks.push(
            <div className="theme-header" key={`sec-${sec}`}>
              {sec} <span className="ct">{groups[sec].length} articles</span>
            </div>,
          )
          ;[...groups[sec]]
            .sort((a, b) => b.d.localeCompare(a.d))
            .forEach((a) => chunks.push(renderArticleRow(a)))
        })
      return chunks
    }

    return null
  }

  const expanded = themeConfig.filter(
    (tc) => expandedThemes.has(tc.name) && tc.subs.length > 0,
  )

  return (
    <div className="pane-left">
      <div className="pane-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <h1>Article library</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              style={{ fontSize: 11, padding: '3px 8px', height: 24 }}
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? 'Cancel' : '+ Import articles'}
            </button>
            <button
              style={{ fontSize: 11, padding: '3px 8px', height: 24 }}
              onClick={onCollapse}
              title="Collapse article library"
              aria-label="Collapse article library"
            >
              ←
            </button>
          </div>
        </div>
        <p className="subtitle">Ingested articles across sources · filter, search, or select to build a theme</p>
      </div>

      {showImport && (
        <ImportArticlesForm
          onClose={() => setShowImport(false)}
          onImportComplete={refreshUserArticles}
        />
      )}

      <div className="controls">
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="chrono">Newest first</option>
          <option value="chrono-asc">Oldest first</option>
          <option value="theme">By theme</option>
          <option value="section">By section</option>
        </select>
        <input
          type="text"
          className="search"
          placeholder="Search titles, authors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => {
            setSearch('')
            setStartDate('')
            setEndDate('')
            setActiveThemes(new Set())
            setActiveSubs(new Set())
            setExpandedThemes(new Set())
          }}
        >
          Clear
        </button>
      </div>

      <div className="date-filter">
        <span className="date-filter-label">Date range</span>
        <input
          type="date"
          value={startDate}
          max={endDate || undefined}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="From date"
        />
        <span className="date-filter-sep">–</span>
        <input
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="To date"
        />
        {(startDate || endDate) && (
          <button
            className="date-filter-clear"
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
            aria-label="Clear date range"
          >
            ×
          </button>
        )}
      </div>

      <div className="tag-label">Themes · click to filter and open sub-topics</div>
      <div className="tags">
        {themeConfig.map((tc) => {
          const hasSubs = tc.subs.length > 0
          const isActive = activeThemes.has(tc.name)
          const isExpanded = expandedThemes.has(tc.name)
          return (
            <span
              key={tc.name}
              className={`tag${isActive ? ' active' : ''}${hasSubs ? ' has-subs' : ''}${isExpanded ? ' expanded' : ''}`}
              onClick={() => {
                toggleTheme(tc.name)
                if (hasSubs) toggleExpanded(tc.name)
              }}
            >
              {tc.name}
              <span className="ct">{themeCounts[tc.name] || 0}</span>
            </span>
          )
        })}
      </div>

      {expanded.length > 0 && (
        <div className="subtag-panel">
          {expanded.map((tc) => {
            const themeActive = activeThemes.has(tc.name)
            return (
              <div className="subtag-group" key={tc.name}>
                <div className="subtag-group-label">
                  {tc.name} —{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      toggleTheme(tc.name)
                    }}
                  >
                    {themeActive ? 'remove filter' : 'filter all'}
                  </a>
                </div>
                <div className="subtags">
                  {tc.subs.map((s) => {
                    const key = tc.name + '||' + s
                    return (
                      <span
                        key={key}
                        className={`subtag${activeSubs.has(key) ? ' active' : ''}`}
                        onClick={() => toggleSub(key)}
                      >
                        {s}
                        <span className="ct">{subCounts[key] || 0}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="meta-row">
        <span>
          {filtered.length} of {allArticles.length} articles
          {selectedTitles.size > 0 ? ` · ${selectedTitles.size} selected` : ''}
        </span>
        <button
          style={{ padding: '2px 8px', fontSize: 11, height: 22 }}
          onClick={() => onSelectMany(filtered.map((a) => a.t))}
        >
          Select visible
        </button>
      </div>

      <div className="pane-body">
        <div className="article-list">{renderList()}</div>
      </div>

      {generating && (
        <div className="generating-banner">
          <span className="spinner" />
          <div className="generating-text">
            <div className="generating-title">Generating theme synthesis…</div>
            <div className="generating-sub">
              {fmtElapsed(elapsedSec)} elapsed · usually 20–30 seconds
            </div>
          </div>
        </div>
      )}

      <div className="selection-bar">
        {selectedTitles.size > 0 && (
          <span className="count">{selectedTitles.size} selected</span>
        )}
        <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          {selectedTitles.size > 0 && (
            <button
              onClick={onClearSelection}
              style={{ fontSize: 12, height: 30, flexShrink: 0 }}
            >
              Clear
            </button>
          )}
          <input
            type="text"
            placeholder="Theme title (optional)"
            value={bundleTitle}
            onChange={(e) => setBundleTitle(e.target.value)}
            style={{ height: 30, fontSize: 12, flex: '1 1 100px', minWidth: 60 }}
          />
          <button
            className="primary"
            style={{ height: 30, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
            disabled={!activeCourseId || selectedTitles.size === 0 || generating}
            onClick={handleGenerateBundle}
          >
            {generating ? (
              <>
                <span className="spinner" />
                Generating…
              </>
            ) : (
              'Generate theme'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
