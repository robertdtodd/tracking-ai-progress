'use client'

import { useState } from 'react'
import ArticleBrowser from '@/components/ArticleBrowser'
import CoursePanel from '@/components/CoursePanel'

export default function Home() {
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set())
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  return (
    <div className="app">
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
      />
      <CoursePanel
        activeCourseId={activeCourseId}
        setActiveCourseId={setActiveCourseId}
        refreshTick={refreshTick}
      />
    </div>
  )
}
