'use client'

import { useEffect, useRef, useState } from 'react'
import type { Bundle, Message } from './CoursePanel'

interface Props {
  bundle: Bundle
  onUpdated: (b: Bundle) => void
}

export default function BundleDetail({ bundle, onUpdated }: Props) {
  const [messages, setMessages] = useState<Message[]>(bundle.messages)
  const [content, setContent] = useState(bundle.generatedContent)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(bundle.messages)
    setContent(bundle.generatedContent)
  }, [bundle.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const optimisticUser: Message = {
      id: 'tmp-' + Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimisticUser])

    try {
      const res = await fetch(`/api/bundles/${bundle.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages((m) => [
          ...m,
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: 'Error: ' + (err.error || res.statusText),
            createdAt: new Date().toISOString(),
          },
        ])
        return
      }

      const { assistantMessage, updatedContent } = await res.json()

      const newMessages: Message[] = [
        optimisticUser,
        {
          id: 'asst-' + Date.now(),
          role: 'assistant',
          content: assistantMessage,
          createdAt: new Date().toISOString(),
        },
      ]

      setMessages((m) => {
        const withoutOptimistic = m.filter((x) => x.id !== optimisticUser.id)
        return [...withoutOptimistic, ...newMessages]
      })
      setContent(updatedContent)
      onUpdated({
        ...bundle,
        generatedContent: updatedContent,
        messages: [...bundle.messages, ...newMessages],
      })
    } finally {
      setSending(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bundle-detail">
      <div>
        <h2 className="title">{bundle.title}</h2>
        <div className="article-refs">
          {bundle.articleTitles.length} articles
          {bundle.themes.length > 0 ? ` · ${bundle.themes.join(', ')}` : ''}
        </div>
      </div>

      <div className="content-box">{content}</div>

      <div className="chat">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
              Ask Claude to refine this content. Try: "Tighten the intro", "Add more on cybersecurity", or "Turn the questions into a worksheet".
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))
          )}
          {sending && (
            <div className="chat-msg assistant">
              <span className="spinner" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Claude to revise the content…"
            disabled={sending}
          />
          <button
            className="primary"
            onClick={handleSend}
            disabled={sending || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
