import { useCallback, useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as expensesApi from '../services/expensesApi'
import { ACTIVITY_UPDATED_EVENT } from '../utils/realtimeStreams'

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
  const isSettlement = entry.status === 'settled'
  const amount = Number(entry.amount || 0)
  const amountAbs = Math.abs(amount)
  const amountLabel = `${amount >= 0 ? '+' : '-'}${formatCurrency(amountAbs)}`
  const intentLabel = isSettlement ? 'Settled' : (amount >= 0 ? 'They owe you' : 'You owe')
  const amountClass = isSettlement
    ? 'activity-amount--settled'
    : (amount >= 0 ? 'activity-amount--positive' : 'activity-amount--negative')
  const note = entry.expense?.note || (isSettlement ? null : 'Untitled expense')

  return (
    <article className="activity-card">
      <div className="activity-card__stack">
        {note ? <span className="activity-card__note">{note}</span> : null}
        <h2>{entry.summary}</h2>
        <p>{entry.detail}</p>
      </div>
      <div className="activity-card__meta">
        <div className="activity-card__amount-block">
          <span className={`activity-amount ${amountClass}`}>{amountLabel}</span>
          <small>{intentLabel}</small>
        </div>
        <time>{formatRelativeTime(entry.created_at)}</time>
        {entry.expense?.id ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onViewExpense(entry.expense.id)}
          >
            View expense
          </button>
        ) : null}
      </div>
    </article>
  )
}

const noScroll = (e) => e.target.blur()

const ExpenseModal = ({ expense, onClose, currentUserId, onDelete, onSave }) => {
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editNote, setEditNote] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [editParticipants, setEditParticipants] = useState([])
  const [editError, setEditError] = useState('')

  const payerName = expense?.payer?.name || 'Someone'
  const isOwner = expense && String(expense.payer?.id) === String(currentUserId)
  const totalOwed = expense
    ? expense.participants.filter((part) => !part.is_payer).reduce((sum, part) => sum + (Number(part.amount) || 0), 0)
    : 0

  const handleStartEdit = () => {
    setEditNote(expense.note || '')
    setEditGroup(expense.group_name || '')
    setEditParticipants(
      (expense.participants || [])
        .filter((p) => !p.is_payer)
        .map((p) => ({
          userId: String(p.user?.id || ''),
          name: p.user?.name || 'Friend',
          amount: String(p.amount ?? '0'),
        }))
    )
    setEditError('')
    setEditMode(true)
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setEditError('')
  }

  const handleParticipantAmount = (index, value) => {
    setEditParticipants((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], amount: value }
      return next
    })
  }

  const computedTotal = editParticipants.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

  const handleSave = async (e) => {
    e.preventDefault()
    const participants = editParticipants.map((p) => ({
      user_id: p.userId,
      amount: parseFloat(p.amount) || 0,
    }))
    if (participants.some((p) => p.amount < 0)) {
      setEditError('Amounts cannot be negative.')
      return
    }
    if (computedTotal <= 0) {
      setEditError('Total must be greater than $0.00.')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      await onSave(expense.id, {
        note: editNote.trim(),
        group_name: editGroup.trim(),
        participants,
      })
      setEditMode(false)
    } catch (err) {
      setEditError(err.message || 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this expense? This will reverse all balance changes.')) return
    setDeleting(true)
    try {
      await onDelete(expense.id)
      onClose()
    } catch (err) {
      alert(err.message || 'Could not delete this expense.')
      setDeleting(false)
    }
  }

  return (
    <div className="activity-modal" role="dialog" aria-modal="true">
      <div className="activity-modal__panel">
        <button type="button" className="activity-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {expense ? (
          editMode ? (
            <form className="activity-modal__edit-form" onSubmit={handleSave}>
              <h3>Edit expense</h3>
              <div className="activity-modal__field">
                <label className="input-label" htmlFor="edit-note">Description</label>
                <input
                  id="edit-note"
                  type="text"
                  className="text-input"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="What was this for?"
                  autoFocus
                />
              </div>
              <div className="activity-modal__field">
                <label className="input-label" htmlFor="edit-group">Group / label</label>
                <input
                  id="edit-group"
                  type="text"
                  className="text-input"
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  placeholder="e.g. Apartment, Trip, Food"
                />
              </div>
              <div className="activity-modal__field">
                <label className="input-label">Participant amounts ($)</label>
                <ul className="activity-modal__edit-participants">
                  {editParticipants.map((p, i) => (
                    <li key={p.userId} className="activity-modal__edit-participant">
                      <span className="activity-modal__edit-participant-name">{p.name}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-input activity-modal__edit-participant-input"
                        value={p.amount}
                        onChange={(e) => handleParticipantAmount(i, e.target.value)}
                        onWheel={noScroll}
                        aria-label={`Amount for ${p.name}`}
                      />
                    </li>
                  ))}
                </ul>
                <p className="hint-text activity-modal__edit-total">
                  Total: {formatCurrency(computedTotal)}
                </p>
              </div>
              {editError ? <p className="activity-modal__error">{editError}</p> : null}
              <div className="activity-modal__footer activity-modal__footer--edit">
                <button type="button" className="ghost-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
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
              {isOwner ? (
                <div className="activity-modal__footer">
                  <button type="button" className="activity-modal__edit-btn" onClick={handleStartEdit}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="activity-modal__delete"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete expense'}
                  </button>
                </div>
              ) : null}
            </>
          )
        ) : (
          <p className="activity-state">No expense details found.</p>
        )}
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

const ActivityPage = () => {
  const { accessToken, refreshAccessToken, user } = useAuth()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [expensesById, setExpensesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedExpenseId, setSelectedExpenseId] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

  const loadActivityFeed = useCallback(async () => {
    if (!accessToken) {
      setEntries([])
      setTotal(0)
      setExpensesById({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [activityPayload, expensesPayload] = await Promise.all([
        expensesApi.fetchActivity({ accessToken, refreshAccessToken }, { limit: PAGE_SIZE, offset: 0 }),
        expensesApi.fetchExpenses({ accessToken, refreshAccessToken }),
      ])
      setEntries(activityPayload?.results || [])
      setTotal(activityPayload?.total ?? activityPayload?.count ?? 0)
      const map = {}
      ;(expensesPayload?.results || []).forEach((expense) => {
        map[expense.id] = expense
      })
      setExpensesById(map)
    } catch (err) {
      setError(err?.message || 'Unable to load activity right now.')
    } finally {
      setLoading(false)
    }
  }, [accessToken, refreshAccessToken])

  const loadMore = useCallback(async () => {
    if (!accessToken || loadingMore) return
    setLoadingMore(true)
    try {
      const activityPayload = await expensesApi.fetchActivity(
        { accessToken, refreshAccessToken },
        { limit: PAGE_SIZE, offset: entries.length },
      )
      const newEntries = activityPayload?.results || []
      setEntries((prev) => [...prev, ...newEntries])
      setTotal(activityPayload?.total ?? activityPayload?.count ?? 0)
    } catch (err) {
      setNotice(err?.message || 'Could not load more activity.')
    } finally {
      setLoadingMore(false)
    }
  }, [accessToken, refreshAccessToken, entries.length, loadingMore])

  useEffect(() => {
    loadActivityFeed()
  }, [loadActivityFeed])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handler = () => {
      if (accessToken) {
        loadActivityFeed()
      }
    }
    window.addEventListener(ACTIVITY_UPDATED_EVENT, handler)
    return () => {
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, handler)
    }
  }, [accessToken, loadActivityFeed])

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

      {!loading && entries.length > 0 && entries.length < total ? (
        <div className="activity-load-more">
          <button
            type="button"
            className="export-btn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : `Load more (${total - entries.length} remaining)`}
          </button>
        </div>
      ) : null}

      {selectedExpenseId ? (
        <ExpenseModal
          expense={selectedExpense}
          onClose={() => setSelectedExpenseId(null)}
          currentUserId={user?.id || user?._id}
          onDelete={async (expenseId) => {
            await expensesApi.deleteExpense({ accessToken, refreshAccessToken }, expenseId)
            await loadActivityFeed()
          }}
          onSave={async (expenseId, data) => {
            const updated = await expensesApi.updateExpense({ accessToken, refreshAccessToken }, expenseId, data)
            setExpensesById((prev) => ({ ...prev, [expenseId]: updated }))
            await loadActivityFeed()
          }}
        />
      ) : null}
    </section>
  )
}

export default ActivityPage
