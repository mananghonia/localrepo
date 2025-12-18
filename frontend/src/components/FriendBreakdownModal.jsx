import { useCallback, useEffect, useMemo, useState } from 'react'
import * as friendsApi from '../services/friendsApi'

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`

const FriendBreakdownModal = ({ friend, auth, onClose, onSettled }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [breakdown, setBreakdown] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSettlingAll, setIsSettlingAll] = useState(false)

  const friendId = friend?.id

  const fetchBreakdown = useCallback(async () => {
    if (!friendId || !auth?.accessToken) return
    setLoading(true)
    setError('')
    try {
      const payload = await friendsApi.fetchFriendBreakdown(auth, friendId)
      setBreakdown(payload)
    } catch (err) {
      setError(err.message || 'Unable to load balance details right now.')
    } finally {
      setLoading(false)
    }
  }, [auth, friendId])

  useEffect(() => {
    if (!friendId) return
    fetchBreakdown()
    setActiveGroup(null)
    setStatus('')
    setError('')
  }, [friendId, fetchBreakdown])

  const groups = useMemo(() => breakdown?.groups || [], [breakdown])
  const hasOutstandingBalances = groups.length > 0

  const handleClose = () => {
    setActiveGroup(null)
    setSettleAmount('')
    setBreakdown(null)
    onClose?.()
  }

  const handleStartSettlement = (group) => {
    setActiveGroup(group)
    setSettleAmount(Number(group.amount || 0).toFixed(2))
    setStatus('')
    setError('')
  }

  const handleSubmitSettlement = async (event) => {
    event.preventDefault()
    if (!friendId || !activeGroup) return
    const numericAmount = Number.parseFloat(settleAmount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter an amount greater than $0.00 to settle.')
      return
    }
    if (numericAmount - activeGroup.amount > 0.01) {
      setError('You cannot settle more than the pending amount for this group.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const result = await friendsApi.settleFriendGroup(auth, friendId, {
        group_slug: activeGroup.slug,
        amount: numericAmount,
      })
      const emailDelivered = result?.settlement?.email_delivered
      const baseMessage = `Marked ${formatCurrency(numericAmount)} as settled in ${activeGroup.label}.`
      setStatus(emailDelivered ? baseMessage : `${baseMessage} Email notification could not be sent.`)
      setActiveGroup(null)
      setSettleAmount('')
      await fetchBreakdown()
      onSettled?.()
    } catch (err) {
      setError(err.message || 'Unable to settle this balance right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSettleAll = async () => {
    if (!friendId) return
    if (!hasOutstandingBalances) {
      setError('No balances left to settle.')
      return
    }
    const confirmationText = `Mark every outstanding group with ${friend.name} as settled? This cannot be undone.`
    if (typeof window !== 'undefined' && !window.confirm(confirmationText)) {
      return
    }
    setIsSettlingAll(true)
    setError('')
    setStatus('')
    try {
      const result = await friendsApi.settleFriendAll(auth, friendId)
      const summary = result?.summary || {}
      const total = Number(summary.total_amount || 0)
      const count = Number(summary.groups_count || 0)
      const baseMessage = `Cleared ${formatCurrency(total)} across ${count} ${count === 1 ? 'group' : 'groups'}.`
      const emailDelivered = Boolean(summary.email_delivered)
      setStatus(emailDelivered ? baseMessage : `${baseMessage} Email notification could not be sent.`)
      setActiveGroup(null)
      setSettleAmount('')
      await fetchBreakdown()
      onSettled?.()
    } catch (err) {
      setError(err.message || 'Unable to settle every group right now.')
    } finally {
      setIsSettlingAll(false)
    }
  }

  if (!friend) {
    return null
  }

  return (
    <div className="friend-detail-overlay" role="dialog" aria-modal="true" onClick={handleClose}>
      <div className="friend-detail-card" onClick={(event) => event.stopPropagation()}>
        <header className="friend-detail__header">
          <div className="friend-detail__top">
            <div>
              <p className="tag-pill pill--soft">Balances with</p>
              <h2>{friend.name}</h2>
            </div>
            <button type="button" className="friend-detail__close" onClick={handleClose} aria-label="Close breakdown">
              ×
            </button>
          </div>
          <p className="hint-text friend-detail__contact">@{friend.username || 'friend'} · {friend.email}</p>
          <div className="friend-detail__hero">
            <div className="friend-detail__stat">
              <p className="hint-text">You owe</p>
              <strong>{formatCurrency(breakdown?.totals?.you_owe || 0)}</strong>
            </div>
            <div className="friend-detail__stat">
              <p className="hint-text">Owes you</p>
              <strong>{formatCurrency(breakdown?.totals?.owes_you || 0)}</strong>
            </div>
            <button
              type="button"
              className="friend-detail__primary"
              onClick={handleSettleAll}
              disabled={!hasOutstandingBalances || loading || isSettlingAll}
            >
              {isSettlingAll ? 'Settling all…' : 'Settle everything'}
            </button>
          </div>
        </header>

        {loading ? <p className="friend-detail__state">Loading group balances...</p> : null}
        {error ? <p className="friend-detail__state friend-detail__state--error">{error}</p> : null}
        {status ? <p className="friend-detail__state friend-detail__state--success">{status}</p> : null}

        {!loading && !groups.length ? (
          <p className="friend-detail__state">No shared group balances yet. Add an expense together to get started.</p>
        ) : null}

        <ul className="friend-detail__groups">
          {groups.map((group) => (
            <li key={group.slug} className="friend-detail__group">
              <div>
                <strong>{group.label}</strong>
                <p className="hint-text">
                  {group.direction === 'owes_you' ? 'They owe you' : 'You owe them'} {formatCurrency(group.amount)}
                </p>
              </div>
              <div className="friend-detail__group-actions">
                <span className={group.direction === 'owes_you' ? 'friends-ledger__amount--positive' : 'friends-ledger__amount--negative'}>
                  {group.direction === 'owes_you' ? '+' : '-'}{formatCurrency(group.amount).replace('+', '')}
                </span>
                <button type="button" className="pill pill--soft" onClick={() => handleStartSettlement(group)}>
                  Settle
                </button>
              </div>
            </li>
          ))}
        </ul>

        {activeGroup ? (
          <form className="friend-detail__form" onSubmit={handleSubmitSettlement}>
            <div>
              <p className="hint-text">Settling {activeGroup.label}</p>
              <label className="input-label" htmlFor="settle-amount">
                Amount to settle
              </label>
              <input
                id="settle-amount"
                type="number"
                min="0"
                step="0.01"
                className="text-input"
                value={settleAmount}
                onChange={(event) => setSettleAmount(event.target.value)}
              />
            </div>
            <div className="friend-detail__form-actions">
              <button type="button" className="ghost-btn" onClick={() => setActiveGroup(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Settling...' : 'Settle now'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}

export default FriendBreakdownModal
