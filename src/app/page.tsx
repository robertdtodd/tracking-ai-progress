'use client'

import { useState } from 'react'
import ArticleBrowser from '@/components/ArticleBrowser'
import CoursePanel from '@/components/CoursePanel'

export default function Home() {
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set())
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [browserCollapsed, setBrowserCollapsed] = useState(false)
  const [engageOpen, setEngageOpen] = useState(false)
  const [presenting, setPresenting] = useState(false)

  function handleToggleEngage() {
    setEngageOpen((prev) => {
      const next = !prev
      if (next) setBrowserCollapsed(true)
      return next
    })
  }

  function handleTogglePresent() {
    setPresenting((prev) => {
      const next = !prev
      if (next) setBrowserCollapsed(true)
      return next
    })
  }

  return (
    <div className={`app${presenting ? ' presenting' : ''}`}>
      {browserCollapsed ? (
        <div className="pane-collapsed">
          <button
            className="pane-expand-btn"
            onClick={() => setBrowserCollapsed(false)}
            title="Show article library"
            aria-label="Show article library"
          >
            →
          </button>
          <div className="pane-collapsed-label">Article library</div>
        </div>
      ) : (
        <ArticleBrowser
          selectedTitles={selectedTitles}
          onToggle={(title) => {
            setSelectedTitles((prev) => {
              const next = new Set(prev)
              if (next.has(title)) next.delete(title)
              else next.add(title)
              return next
            })
          }}
          onSelectMany={(titles) => {
            setSelectedTitles((prev) => {
              const next = new Set(prev)
              titles.forEach((t) => next.add(t))
              return next
            })
          }}
          onClearSelection={() => setSelectedTitles(new Set())}
          activeCourseId={activeCourseId}
          onBundleCreated={() => {
            setSelectedTitles(new Set())
            setRefreshTick((t) => t + 1)
          }}
          onCollapse={() => setBrowserCollapsed(true)}
        />
      )}
      <CoursePanel
        activeCourseId={activeCourseId}
        setActiveCourseId={setActiveCourseId}
        refreshTick={refreshTick}
        engageOpen={engageOpen}
        onToggleEngage={handleToggleEngage}
        presenting={presenting}
        onTogglePresent={handleTogglePresent}
      />
    </div>
  )
}
