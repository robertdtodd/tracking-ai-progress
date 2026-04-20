'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  onClose: () => void
  onImportComplete: () => void
}

type Stats = {
  inserted: number
  skippedExisting: number
  skippedIrrelevant: number
  errored: number
}

type Status = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

const TODAY = new Date().toISOString().slice(0, 10)
const DEFAULT_FROM = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
})()

function monthsBetween(from: string, to: string): number {
  if (!from || !to || from > to) return 0
  const [fy, fm] = from.slice(0, 7).split('-').map(Number)
  const [ty, tm] = to.slice(0, 7).split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm) + 1
}

function estimateMinutes(from: string, to: string, sources: Set<string>): { low: number; high: number } {
  const months = monthsBetween(from, to)
  if (months === 0 || sources.size === 0) return { low: 0, high: 0 }
  let low = 0
  let high = 0
  if (sources.has('nyt')) {
    low += months * 2
    high += months * 5
  }
  if (sources.has('guardian')) {
    low += months * 0.5
    high += months * 2
  }
  return { low, high }
}

function fmtMinutes(m: number): string {
  if (m < 1) return '<1 min'
  if (m < 60) return `${Math.round(m)} min`
  const hours = m / 60
  if (hours < 10) return `${hours.toFixed(1)} hr`
  return `${Math.round(hours)} hr`
}

export default function ImportArticlesForm({ onClose, onImportComplete }: Props) {
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(TODAY)
  const [sources, setSources] = useState<Set<string>>(new Set(['nyt', 'guardian']))
  const [status, setStatus] = useState<Status>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState<Stats>({
    inserted: 0,
    skippedExisting: 0,
    skippedIrrelevant: 0,
    errored: 0,
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const estimate = useMemo(() => estimateMinutes(from, to, sources), [from, to, sources])
  const months = monthsBetween(from, to)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs.length])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function toggleSource(s: string) {
    setSources((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  async function handleStart() {
    setStatus('running')
    setLogs([])
    setStats({ inserted: 0, skippedExisting: 0, skippedIrrelevant: 0, errored: 0 })
    setErrorMsg(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, sources: Array.from(sources) }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => res.statusText)
        setErrorMsg(text || 'Import failed')
        setStatus('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            handleEvent(event)
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus((s) => (s === 'running' ? 'cancelled' : s))
      } else {
        setErrorMsg((err as Error).message)
        setStatus('error')
      }
    } finally {
      abortRef.current = null
      onImportComplete()
    }
  }

  function handleEvent(event: any) {
    if (event.type === 'log') {
      setLogs((prev) => [...prev, event.message])
    } else if (event.type === 'stats') {
      setStats({
        inserted: event.inserted,
        skippedExisting: event.skippedExisting,
        skippedIrrelevant: event.skippedIrrelevant,
        errored: event.errored,
      })
    } else if (event.type === 'done') {
      setStats({
        inserted: event.inserted,
        skippedExisting: event.skippedExisting,
        skippedIrrelevant: event.skippedIrrelevant,
        errored: event.errored,
      })
      setStatus('done')
    } else if (event.type === 'cancelled') {
      setStats({
        inserted: event.inserted,
        skippedExisting: event.skippedExisting,
        skippedIrrelevant: event.skippedIrrelevant,
        errored: event.errored,
      })
      setStatus('cancelled')
    } else if (event.type === 'error') {
      setErrorMsg(event.message)
      setStats({
        inserted: event.inserted,
        skippedExisting: event.skippedExisting,
        skippedIrrelevant: event.skippedIrrelevant,
        errored: event.errored,
      })
      setStatus('error')
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  const canStart = from && to && from <= to && sources.size > 0

  return (
    <div className="import-form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>Import articles</div>
        {status === 'idle' && (
          <button
            style={{ fontSize: 11, padding: '2px 8px', height: 22, border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }}
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      {status === 'idle' && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 34 }}>From</label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: '5px 8px', height: 28 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 34 }}>To</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: '5px 8px', height: 28 }}
            />
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 2 }}>
            Sources
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sources.has('nyt')}
                onChange={() => toggleSource('nyt')}
              />
              NYT
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sources.has('guardian')}
                onChange={() => toggleSource('guardian')}
              />
              Guardian
            </label>
          </div>

          <div className="import-estimate">
            {canStart ? (
              <>
                <span>Est. time: </span>
                <strong>
                  {estimate.low === 0
                    ? '—'
                    : estimate.low === estimate.high
                      ? fmtMinutes(estimate.low)
                      : `${fmtMinutes(estimate.low)}–${fmtMinutes(estimate.high)}`}
                </strong>
                <span style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>
                  · {months} {months === 1 ? 'month' : 'months'} · {Array.from(sources).join('+')}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-tertiary)' }}>Pick a valid date range and at least one source</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button style={{ fontSize: 12, padding: '6px 12px' }} onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={handleStart}
              disabled={!canStart}
            >
              Start import
            </button>
          </div>
        </>
      )}

      {status !== 'idle' && (
        <>
          <div className="import-stats">
            <span><strong>{stats.inserted}</strong> inserted</span>
            <span><strong>{stats.skippedExisting}</strong> already in DB</span>
            <span><strong>{stats.skippedIrrelevant}</strong> not AI</span>
            <span><strong>{stats.errored}</strong> errors</span>
          </div>

          <div ref={logRef} className="import-log">
            {logs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            {status === 'running' && (
              <div style={{ color: 'var(--text-tertiary)' }}>
                <span className="spinner" /> working…
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{ fontSize: 12, color: '#b91c1c', padding: '4px 0' }}>{errorMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {status === 'running' && 'Running…'}
              {status === 'done' && 'Complete.'}
              {status === 'cancelled' && 'Cancelled.'}
              {status === 'error' && 'Errored.'}
            </div>
            {status === 'running' ? (
              <button
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={handleCancel}
              >
                Cancel
              </button>
            ) : (
              <button
                className="primary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
