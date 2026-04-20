'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/'
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Login failed')
        return
      }
      router.replace(nextPath)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-view">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Editor sign-in</h1>
        <p className="login-sub">
          Enter the editor password to continue. Student browse pages (<code>/browse/…</code>) stay public.
        </p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="primary" disabled={submitting || !password}>
          {submitting ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-view"><div className="login-form">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  )
}
