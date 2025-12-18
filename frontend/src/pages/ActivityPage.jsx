import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as expensesApi from '../services/expensesApi'

const formatCurrency = (value) => {
  const parsed = Number.isFinite(Number(value)) ? Number(value) : 0
  return parsed.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const formatRelativeTime = (isoString) => {
  if (!isoString) {
    return 'Just now'
  }
  const timestamp = new Date(isoString)
  const diffMs = Date.now() - timestamp.getTime()
  if (Number.isNaN(diffMs)) {
    return 'Just now'
  }
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return timestamp.toLocaleDateString()
}

const ActivityCard = ({ entry, onViewExpense }) => {
  const amount = Number(entry.amount || 0)
  const amountAbs = Math.abs(amount)
  const amountLabel = `${amount >= 0 ? '+' : '-'}${formatCurrency(amountAbs)}`
  const intentLabel = amount >= 0 ? 'They owe you' : 'You owe'
  const amountClass = amount >= 0 ? 'activity-amount--positive' : 'activity-amount--negative'
  const note = entry.expense?.note || 'Untitled expense'

  return (
    <article className="activity-card">
      <div className="activity-card__stack">
        <span className="activity-card__note">{note}</span>
        <h2>{entry.summary}</h2>
        <p>{entry.detail}</p>
      </div>
      <div className="activity-card__meta">
        <div className="activity-card__amount-block">
          <span className={`activity-amount ${amountClass}`}>{amountLabel}</span>
          <small>{intentLabel}</small>
        </div>
        <time>{formatRelativeTime(entry.created_at)}</time>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => entry.expense?.id && onViewExpense(entry.expense.id)}
          disabled={!entry.expense?.id}
        >
          View expense
        </button>
      </div>
    </article>
  )
}

const ExpenseModal = ({ expense, onClose, currentUserId }) => {
  const payerName = expense?.payer?.name || 'Someone'
  const totalOwed = expense
    ? expense.participants.filter((part) => !part.is_payer).reduce((sum, part) => sum + (Number(part.amount) || 0), 0)
    : 0

  return (
    <div className="activity-modal" role="dialog" aria-modal="true">
      <div className="activity-modal__panel">
        <button type="button" className="activity-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {expense ? (
          <>
            <h3>{expense.note || 'Untitled expense'}</h3>
            <p className="activity-modal__subtitle">
              Created by {payerName} • {formatCurrency(expense.total_amount)}
            </p>
            <ul className="activity-modal__list">
              {expense.participants.map((participant) => {
                const isViewer = String(participant.user?.id) === String(currentUserId)
                const toneClass = participant.is_payer ? 'activity-modal__amount--positive' : 'activity-modal__amount--negative'
                const displayAmount = participant.is_payer
                  ? totalOwed > 0
                    ? `+${formatCurrency(totalOwed)}`
                    : formatCurrency(0)
                  : `-${formatCurrency(participant.amount)}`
                const helperText = participant.is_payer
                  ? totalOwed > 0
                    ? `Should receive ${formatCurrency(totalOwed)} total`
                    : 'This one is fully settled'
                  : `Owes ${formatCurrency(participant.amount)} to ${payerName}`
                return (
                  <li key={`${expense.id}-${participant.user?.id || participant.user?.name}`}>
                    <div className="activity-modal__person">
                      <strong>
                        {participant.user?.name || 'Friend'}
                        {isViewer ? ' (You)' : ''}
                      </strong>
                      <span className="hint-text">{helperText}</span>
                    </div>
                    <span className={`activity-modal__amount ${toneClass}`}>{displayAmount}</span>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="activity-state">No expense details found.</p>
        )}
      </div>
    </div>
  )
}

const ActivityPage = () => {
  const { accessToken, refreshAccessToken, user } = useAuth()
  const [entries, setEntries] = useState([])
  const [expensesById, setExpensesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedExpenseId, setSelectedExpenseId] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [activityPayload, expensesPayload] = await Promise.all([
          expensesApi.fetchActivity({ accessToken, refreshAccessToken }),
          expensesApi.fetchExpenses({ accessToken, refreshAccessToken }),
        ])

        if (cancelled) return

        setEntries(activityPayload?.results || [])
        const map = {}
        ;(expensesPayload?.results || []).forEach((expense) => {
          map[expense.id] = expense
        })
        setExpensesById(map)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load activity right now.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [accessToken, refreshAccessToken])

  const selectedExpense = selectedExpenseId ? expensesById[selectedExpenseId] : null

  const handleViewExpense = (expenseId) => {
    if (!expenseId) return
    if (!expensesById[expenseId]) {
      setNotice('We are still syncing that expense. Please try again in a moment.')
      return
    }
    setNotice('')
    setSelectedExpenseId(expenseId)
  }

  const handleExport = () => {
    if (!entries.length) {
      setNotice('Log an expense to export the activity feed.')
      return
    }
    setNotice('')
    setIsExporting(true)
    try {
      const doc = new jsPDF()
      const margin = 16
      let cursorY = margin
      doc.setFontSize(16)
      doc.text('Balance Studio Activity Log', margin, cursorY)
      doc.setFontSize(10)
      doc.text(new Date().toLocaleString(), margin, (cursorY += 6))
      doc.setDrawColor(60, 60, 60)
      doc.line(margin, (cursorY += 4), 200 - margin, cursorY)
      cursorY += 8

      entries.forEach((entry, index) => {
        const block = [
          `${index + 1}. ${entry.expense?.note || 'Untitled expense'}`,
          entry.summary,
          entry.detail,
          `${formatCurrency(entry.amount || 0)} · ${formatRelativeTime(entry.created_at)}`,
        ]
        block.forEach((line) => {
          const split = doc.splitTextToSize(line, 200 - margin * 2)
          if (cursorY + split.length * 6 > 280) {
            doc.addPage()
            cursorY = margin
          }
          doc.text(split, margin, cursorY)
          cursorY += split.length * 6
        })
        cursorY += 4
      })

      const filename = `balance-activity-${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(filename)
      setNotice('Activity log downloaded.')
    } catch (exportError) {
      setNotice(exportError?.message || 'Unable to create the PDF right now.')
    } finally {
      setIsExporting(false)
    }
  }

  const renderFeed = () => {
    if (loading) {
      return <div className="activity-state">Loading activity...</div>
    }
    if (error) {
      return <div className="activity-state activity-state--error">{error}</div>
    }
    if (!entries.length) {
      return <div className="activity-state">No activity yet—log an expense to get started.</div>
    }
    return entries.map((entry) => (
      <ActivityCard key={entry.id} entry={entry} onViewExpense={handleViewExpense} />
    ))
  }

  return (
    <section className="workspace-screen activity-page">
      <AppNav />
      <div className="activity-hero">
        <h1>Everything happening this week</h1>
        <p>Stay current on expense approvals, settlements, and invitations across your groups.</p>
        <div className="activity-hero__actions">
          <button type="button" className="export-btn" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Preparing PDF...' : 'Download log'}
          </button>
        </div>
        {notice ? <p className="activity-notice">{notice}</p> : null}
      </div>

      <div className="activity-feed">{renderFeed()}</div>

      {selectedExpenseId ? (
        <ExpenseModal expense={selectedExpense} onClose={() => setSelectedExpenseId(null)} currentUserId={user?.id || user?._id} />
      ) : null}
    </section>
  )
}

export default ActivityPage
