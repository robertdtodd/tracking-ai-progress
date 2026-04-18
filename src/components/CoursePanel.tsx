'use client'

import { useEffect, useState } from 'react'
import BundleDetail from './BundleDetail'

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
  createdAt: string
}

export type Bundle = {
  id: string
  position: number
  title: string
  articleTitles: string[]
  themes: string[]
  generatedContent: string
  messages: Message[]
}

type CourseDetail = {
  id: string
  name: string
  bundles: Bundle[]
}

interface Props {
  activeCourseId: string | null
  setActiveCourseId: (id: string | null) => void
  refreshTick: number
}

export default function CoursePanel({
  activeCourseId,
  setActiveCourseId,
  refreshTick,
}: Props) {
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
            onClick={handleDeleteCourse}
            style={{ color: 'var(--text-secondary)' }}
          >
            Delete
          </button>
        )}
      </div>

      {!activeCourseId ? (
        <div className="empty-state">
          <h3>No course selected</h3>
          <p>Create a new course or pick one from the dropdown above, then select articles to the left and generate a bundle.</p>
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
                No bundles yet. Select articles to the left and click "Generate bundle".
              </div>
            ) : (
              course.bundles.map((b) => (
                <div
                  key={b.id}
                  className={`bundle-card${b.id === activeBundleId ? ' active' : ''}`}
                  onClick={() => setActiveBundleId(b.id)}
                >
                  <div className="position">Bundle {b.position + 1}</div>
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
            <BundleDetail bundle={activeBundle} onUpdated={handleBundleUpdated} />
          ) : (
            <div className="empty-state">
              <h3>{course.name}</h3>
              <p>Select articles on the left, add a bundle title if you want, and click "Generate bundle".</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
