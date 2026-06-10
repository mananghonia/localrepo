import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { sendAIMessage } from '../services/aiApi.js'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const STORAGE_KEY = 'bs_ai_sessions'
const ACTIVE_KEY  = 'bs_ai_active'

const SUGGESTED = [
  'What is my current net balance?',
  'Who owes me the most money?',
  'Summarize my recent expenses',
  'Which group has the highest unsettled amount?',
  'How much have I spent in total?',
]

const SparkleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M5 16L5.75 18.75L8.5 19.5L5.75 20.25L5 23L4.25 20.25L1.5 19.5L4.25 18.75L5 16Z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M19 2L19.6 4.4L22 5L19.6 5.6L19 8L18.4 5.6L16 5L18.4 4.4L19 2Z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
)

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 7h12M9 7V5h6v2M10 11v6M14 11v6M5 7l1 13h12l1-13"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const relativeTime = (ts) => {
  const d = Date.now() - ts
  if (d < 60_000)        return 'just now'
  if (d < 3_600_000)     return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000)    return `${Math.floor(d / 3_600_000)}h ago`
  if (d < 604_800_000)   return `${Math.floor(d / 86_400_000)}d ago`
  return new Date(ts).toLocaleDateString()
}

const loadSessions = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

// ── Component ───────────────────────────────────────────────────────
const AIPage = () => {
  const { accessToken, refreshAccessToken, user } = useAuth()

  const [sessions, setSessions]     = useState(loadSessions)
  const [activeId, setActiveId]     = useState(() => {
    const saved = localStorage.getItem(ACTIVE_KEY)
    const all   = loadSessions()
    return (saved && all.find(s => s.id === saved)) ? saved : (all[0]?.id ?? null)
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const activeSession = sessions.find(s => s.id === activeId) ?? null
  const messages      = activeSession?.messages ?? []
  const isEmpty       = messages.length === 0

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Session helpers ────────────────────────────────────────────────
  const createSession = () => {
    const s = { id: uid(), name: 'New conversation', messages: [], updatedAt: Date.now() }
    setSessions(prev => [s, ...prev])
    setActiveId(s.id)
    setError('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const removeSession = (id, e) => {
    e.stopPropagation()
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  // ── Send message ───────────────────────────────────────────────────
  const submit = async (text) => {
    const message = (text ?? input).trim()
    if (!message || loading) return

    // Ensure we have an active session
    let targetId = activeId
    if (!targetId || !sessions.find(s => s.id === targetId)) {
      const s = { id: uid(), name: message.slice(0, 42), messages: [], updatedAt: Date.now() }
      setSessions(prev => [s, ...prev])
      setActiveId(s.id)
      targetId = s.id
    }

    // Snapshot history BEFORE state update (avoid stale closure in async)
    const priorMsgs = sessions.find(s => s.id === targetId)?.messages ?? []
    const history   = priorMsgs.slice(-6)

    const userMsg = { role: 'user', content: message }

    setSessions(prev => prev.map(s => {
      if (s.id !== targetId) return s
      const isFirst = s.messages.length === 0
      return {
        ...s,
        messages:   [...s.messages, userMsg],
        name:       isFirst ? message.slice(0, 42) : s.name,
        updatedAt:  Date.now(),
      }
    }))

    setInput('')
    setLoading(true)
    setError('')

    try {
      const data = await sendAIMessage({ accessToken, refreshAccessToken }, message, history)
      setSessions(prev => prev.map(s => {
        if (s.id !== targetId) return s
        return { ...s, messages: [...s.messages, { role: 'assistant', content: data.reply }], updatedAt: Date.now() }
      }))
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
      setSessions(prev => prev.map(s => {
        if (s.id !== targetId) return s
        return { ...s, messages: s.messages.filter(m => m !== userMsg) }
      }))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <section className="ai-screen">
      <AppNav />

      <div className="ai-layout">

        {/* ── Sidebar ── */}
        <aside className={`ai-sidebar${sidebarOpen ? '' : ' ai-sidebar--hidden'}`}>
          <div className="ai-sidebar__head">
            <span className="ai-sidebar__label">Conversations</span>
            <button type="button" className="ai-sidebar__new" onClick={createSession} title="New conversation">
              <PlusIcon />
            </button>
          </div>

          <div className="ai-sidebar__sessions">
            {sessions.length === 0 ? (
              <p className="ai-sidebar__empty">No conversations yet</p>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`ai-session${s.id === activeId ? ' ai-session--active' : ''}`}
                  onClick={() => { setActiveId(s.id); setError('') }}
                >
                  <div className="ai-session__body">
                    <span className="ai-session__name">{s.name}</span>
                    <span className="ai-session__time">{relativeTime(s.updatedAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="ai-session__del"
                    onClick={(e) => removeSession(s.id, e)}
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Chat area ── */}
        <div className="ai-chat">

          {/* Top bar: sidebar toggle + session name */}
          <div className="ai-chat__bar">
            <button type="button" className="ai-chat__toggle" onClick={() => setSidebarOpen(p => !p)} title="Toggle sidebar">
              <MenuIcon />
            </button>
            <span className="ai-chat__session-name">
              {activeSession ? activeSession.name : 'AI Finance Assistant'}
            </span>
            <button type="button" className="ai-chat__new" onClick={createSession} title="New conversation">
              <PlusIcon />
              <span>New chat</span>
            </button>
          </div>

          <div className="ai-body">
            <div
              className="ai-inner"
              style={isEmpty ? { display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'center' } : undefined}
            >
              {isEmpty ? (
                <div className="ai-welcome" style={{ paddingTop: 0 }}>
                  <div className="ai-welcome__icon">
                    <SparkleIcon size={26} />
                  </div>
                  <h1>AI Finance Assistant</h1>
                  <p className="ai-welcome__sub">
                    Ask anything about your balances, expenses, or friends.
                    Your live data is used as context — nothing is stored externally.
                  </p>
                  <div className="ai-chips">
                    {SUGGESTED.map(s => (
                      <button key={s} type="button" className="ai-chip" onClick={() => submit(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ai-messages">
                  {messages.map((msg, i) => (
                    <div key={i} className={`ai-msg ai-msg--${msg.role === 'user' ? 'user' : 'ai'}`}>
                      {msg.role === 'assistant' && (
                        <div className="ai-avatar"><SparkleIcon size={14} /></div>
                      )}
                      <div className={`ai-bubble ai-bubble--${msg.role === 'user' ? 'user' : 'ai'}`}>
                        {msg.role === 'assistant'
                          ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                          : msg.content}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="ai-thinking">
                      <div className="ai-avatar"><SparkleIcon size={14} /></div>
                      <div className="ai-thinking__bubble">
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="error-banner" style={{ marginBottom: '0.9rem' }}>{error}</div>
                  )}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="ai-footer">
            <div className="ai-composer">
              <textarea
                ref={inputRef}
                rows={1}
                className="text-input"
                placeholder={`Ask about your finances, ${user?.name?.split(' ')[0] || 'there'}…`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                type="button"
                className="ai-send-btn"
                onClick={() => submit()}
                disabled={loading || !input.trim()}
              >
                {loading ? '…' : 'Send'}
              </button>
            </div>
            {!isEmpty && (
              <p className="ai-footer__hint">
                Powered by your live Balance Studio data · Enter to send
              </p>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}

export default AIPage
