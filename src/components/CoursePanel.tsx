'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BundleDetail from './BundleDetail'
import EngagePanel from './EngagePanel'

type CourseSummary = {
  id: string
  name: string
  createdAt: string
  _count: { bundles: number }
}

export type Message = {
  id: string
  role: string
  content: string
  mode: string
  createdAt: string
}

export type Highlight = {
  id: string
  anchorText: string
  color: string
  note: string | null
  position: number
}

export type Bundle = {
  id: string
  position: number
  title: string
  articleTitles: string[]
  themes: string[]
  generatedContent: string
  published: boolean
  publishedAt: string | null
  messages: Message[]
  highlights: Highlight[]
}

type CourseDetail = {
  id: string
  name: string
  description: string | null
  bundles: Bundle[]
}

interface Props {
  activeCourseId: string | null
  setActiveCourseId: (id: string | null) => void
  refreshTick: number
  engageOpen: boolean
  onToggleEngage: () => void
  presenting: boolean
  onTogglePresent: () => void
}

export default function CoursePanel({
  activeCourseId,
  setActiveCourseId,
  refreshTick,
  engageOpen,
  onToggleEngage,
  presenting,
  onTogglePresent,
}: Props) {
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  async function fetchCourses() {
    const res = await fetch('/api/courses')
    if (res.ok) setCourses(await res.json())
  }

  async function fetchCourse(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/courses/${id}`)
      if (res.ok) {
        const data: CourseDetail = await res.json()
        setCourse(data)
        if (data.bundles.length > 0 && !data.bundles.find((b) => b.id === activeBundleId)) {
          setActiveBundleId(data.bundles[data.bundles.length - 1].id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (activeCourseId) fetchCourse(activeCourseId)
    else setCourse(null)
  }, [activeCourseId, refreshTick])

  async function handleCreateCourse() {
    const name = prompt('Course name?')
    if (!name?.trim()) return
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      const created = await res.json()
      await fetchCourses()
      setActiveCourseId(created.id)
      setActiveBundleId(null)
    }
  }

  async function handleDeleteCourse() {
    if (!activeCourseId || !course) return
    if (!confirm(`Delete course "${course.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/courses/${activeCourseId}`, { method: 'DELETE' })
    if (res.ok) {
      setActiveCourseId(null)
      setActiveBundleId(null)
      await fetchCourses()
    }
  }

  function handleOpenInfo() {
    if (!course) return
    setDraftName(course.name)
    setDraftDescription(course.description ?? '')
    setInfoOpen(true)
  }

  function handleCancelInfo() {
    setInfoOpen(false)
  }

  async function handleSaveInfo() {
    if (!course) return
    const trimmedName = draftName.trim()
    if (!trimmedName) return
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, description: draftDescription }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCourse({ ...course, name: updated.name, description: updated.description })
        await fetchCourses()
        setInfoOpen(false)
      }
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleDeleteBundle(bundleId: string, bundleTitle: string) {
    if (!confirm(`Delete theme "${bundleTitle}"? This cannot be undone.`)) return
    const res = await fetch(`/api/bundles/${bundleId}`, { method: 'DELETE' })
    if (res.ok && course) {
      const remaining = course.bundles.filter((b) => b.id !== bundleId)
      setCourse({ ...course, bundles: remaining })
      if (activeBundleId === bundleId) {
        setActiveBundleId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
      }
      await fetchCourses()
    }
  }

  function handleBundleUpdated(updated: Bundle) {
    if (!course) return
    setCourse({
      ...course,
      bundles: course.bundles.map((b) => (b.id === updated.id ? updated : b)),
    })
  }

  const activeBundle = course?.bundles.find((b) => b.id === activeBundleId) ?? null

  return (
    <div className="pane-right">
      <div className="course-bar">
        <select
          value={activeCourseId ?? ''}
          onChange={(e) => {
            setActiveCourseId(e.target.value || null)
            setActiveBundleId(null)
          }}
        >
          <option value="">— Select a course —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c._count.bundles})
            </option>
          ))}
        </select>
        <button onClick={handleCreateCourse}>+ New course</button>
        {activeCourseId && (
          <button
            onClick={handleOpenInfo}
            style={{ color: 'var(--text-secondary)' }}
            title="Edit course name and description"
          >
            Course Info
          </button>
        )}
        {activeCourseId && (
          <Link
            href={`/browse/${activeCourseId}`}
            className="trends-link"
            title="Open student browse view for this course"
            target="_blank"
            rel="noopener noreferrer"
          >
            Browse ↗
          </Link>
        )}
        {activeCourseId && (
          <button
            onClick={handleDeleteCourse}
            style={{ color: 'var(--text-secondary)' }}
          >
            Delete
          </button>
        )}
        <Link href="/trends" className="trends-link" title="Open thematic trends">
          Trends →
        </Link>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          style={{ color: 'var(--text-secondary)' }}
          title="Sign out"
        >
          Sign out
        </button>
      </div>

      {!activeCourseId ? (
        <div className="empty-state">
          <h3>No course selected</h3>
          <p>Create a new course or pick one from the dropdown above, then select articles to the left and generate a theme.</p>
        </div>
      ) : loading && !course ? (
        <div className="empty-state">
          <span className="spinner" /> Loading…
        </div>
      ) : course ? (
        <>
          <div className="bundle-strip">
            {course.bundles.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                No themes yet. Select articles to the left and click "Generate theme".
              </div>
            ) : (
              course.bundles.map((b) => (
                <div
                  key={b.id}
                  className={`bundle-card${b.id === activeBundleId ? ' active' : ''}`}
                  onClick={() => setActiveBundleId(b.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="position">Theme {b.position + 1}</div>
                    <button
                      className="delete-theme-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteBundle(b.id, b.title)
                      }}
                      title="Delete this theme"
                    >
                      ×
                    </button>
                  </div>
                  <div className="title">{b.title}</div>
                  <div className="meta">
                    {b.articleTitles.length} articles
                    {b.themes.length > 0 && ` · ${b.themes.length} themes`}
                  </div>
                </div>
              ))
            )}
          </div>

          {activeBundle ? (
            <div className={`bundle-layout${engageOpen ? ' has-engage' : ''}`}>
              <BundleDetail
                bundle={activeBundle}
                engageOpen={engageOpen}
                onToggleEngage={onToggleEngage}
                presenting={presenting}
                onTogglePresent={onTogglePresent}
                onUpdated={handleBundleUpdated}
              />
              {engageOpen && (
                <EngagePanel
                  bundle={activeBundle}
                  onUpdated={handleBundleUpdated}
                  onClose={onToggleEngage}
                />
              )}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{course.name}</h3>
              <p>Select articles on the left, add a theme title if you want, and click "Generate theme".</p>
            </div>
          )}
        </>
      ) : null}

      {infoOpen && course && (
        <div className="modal-overlay" onClick={handleCancelInfo}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Course Info</h3>
            <label className="modal-field">
              <span className="modal-label">Name</span>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="modal-field">
              <span className="modal-label">Description (shown to students)</span>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={4}
              />
            </label>
            <div className="modal-actions">
              <button onClick={handleCancelInfo} disabled={savingInfo}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={handleSaveInfo}
                disabled={savingInfo || !draftName.trim()}
              >
                {savingInfo ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
