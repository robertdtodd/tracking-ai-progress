'use client'

import { useEffect, useMemo, useState } from 'react'
import { articles as staticArticles, themeConfig, Article } from '@/lib/articles'

interface Props {
  selectedTitles: Set<string>
  onToggle: (title: string) => void
  onSelectMany: (titles: string[]) => void
  onClearSelection: () => void
  activeCourseId: string | null
  onBundleCreated: () => void
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

const TODAY = new Date().toISOString().slice(0, 10)

export default function ArticleBrowser({
  selectedTitles,
  onToggle,
  onSelectMany,
  onClearSelection,
  activeCourseId,
  onBundleCreated,
}: Props) {
  const [userArticles, setUserArticles] = useState<Article[]>([])
  const [view, setView] = useState('chrono')
  const [search, setSearch] = useState('')
  const [activeThemes, setActiveThemes] = useState<Set<string>>(new Set())
  const [activeSubs, setActiveSubs] = useState<Set<string>>(new Set())
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [bundleTitle, setBundleTitle] = useState('')

  // Add article form state
  const [showAddArticle, setShowAddArticle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [newDate, setNewDate] = useState(TODAY)
  const [newSection, setNewSection] = useState('')
  const [newThemes, setNewThemes] = useState<string[]>([])
  const [addingArticle, setAddingArticle] = useState(false)

  useEffect(() => {
    fetch('/api/articles')
      .then((r) => (r.ok ? r.json() : []))
      .then(setUserArticles)
      .catch(() => {})
  }, [])

  const allArticles = useMemo(
    () => [...staticArticles, ...userArticles],
    [userArticles],
  )

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
  }, [allArticles, search, activeThemes, activeSubs])

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

  async function handleAddArticle() {
    if (!newTitle.trim() || !newDate || !newSection.trim()) return
    setAddingArticle(true)
    try {
      const themesObj: Record<string, string[]> = {}
      newThemes.forEach((t) => (themesObj[t] = []))

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          author: newAuthor.trim() || null,
          date: newDate,
          section: newSection.trim(),
          themes: themesObj,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed: ' + (err.error || res.statusText))
        return
      }
      const article: Article = await res.json()
      setUserArticles((prev) => [article, ...prev])
      setNewTitle('')
      setNewAuthor('')
      setNewDate(TODAY)
      setNewSection('')
      setNewThemes([])
      setShowAddArticle(false)
    } finally {
      setAddingArticle(false)
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>NYT AI articles browser</h1>
          <button
            style={{ fontSize: 11, padding: '3px 8px', height: 24 }}
            onClick={() => setShowAddArticle((v) => !v)}
          >
            {showAddArticle ? 'Cancel' : '+ Add article'}
          </button>
        </div>
        <p className="subtitle">Times Topics: Artificial Intelligence — Feb 28 to Apr 17, 2026</p>
      </div>

      {showAddArticle && (
        <div className="add-article-form">
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Add article to library</div>
          <input
            type="text"
            placeholder="Title (required)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Author (optional)"
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              placeholder="Section (e.g. Technology)"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
            Themes (optional):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {themeConfig.map((tc) => (
              <label key={tc.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newThemes.includes(tc.name)}
                  onChange={(e) => {
                    if (e.target.checked) setNewThemes((prev) => [...prev, tc.name])
                    else setNewThemes((prev) => prev.filter((t) => t !== tc.name))
                  }}
                />
                {tc.name}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="primary"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={handleAddArticle}
              disabled={addingArticle || !newTitle.trim() || !newSection.trim() || !newDate}
            >
              {addingArticle ? 'Adding…' : 'Add article'}
            </button>
            <button
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setShowAddArticle(false)}
            >
              Cancel
            </button>
          </div>
        </div>
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
            setActiveThemes(new Set())
            setActiveSubs(new Set())
            setExpandedThemes(new Set())
          }}
        >
          Clear
        </button>
      </div>

      <div className="tag-label">Themes · click ▾ for sub-topics · shift-click to filter</div>
      <div className="tags">
        {themeConfig.map((tc) => {
          const hasSubs = tc.subs.length > 0
          const isActive = activeThemes.has(tc.name)
          const isExpanded = expandedThemes.has(tc.name)
          return (
            <span
              key={tc.name}
              className={`tag${isActive ? ' active' : ''}${hasSubs ? ' has-subs' : ''}${isExpanded ? ' expanded' : ''}`}
              onClick={(e) => {
                if (hasSubs && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                  toggleExpanded(tc.name)
                } else {
                  toggleTheme(tc.name)
                }
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

      <div className="selection-bar">
        <span className="count">
          {selectedTitles.size === 0
            ? 'Select articles to build a theme'
            : `${selectedTitles.size} selected`}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {selectedTitles.size > 0 && (
            <button onClick={onClearSelection} style={{ fontSize: 12, height: 30 }}>
              Clear
            </button>
          )}
          <input
            type="text"
            placeholder="Theme title (optional)"
            value={bundleTitle}
            onChange={(e) => setBundleTitle(e.target.value)}
            style={{ width: 160, height: 30, fontSize: 12 }}
          />
          <button
            className="primary"
            style={{ height: 30, fontSize: 12 }}
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
