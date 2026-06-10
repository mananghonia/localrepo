import { formatRelativeTime } from '../utils/formatTime.js'

const formatCurrency = (value) => {
  const parsed = Number.isFinite(Number(value)) ? Number(value) : 0
  return parsed.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const ActivityCard = ({ entry, onViewExpense }) => {
  const isSettlement = entry.status === 'settled'
  const amount = Number(entry.amount || 0)
  const amountAbs = Math.abs(amount)
  const amountLabel = `${amount >= 0 ? '+' : '-'}${formatCurrency(amountAbs)}`
  const intentLabel = isSettlement ? 'Settled' : amount >= 0 ? 'They owe you' : 'You owe'
  const amountClass = isSettlement
    ? 'activity-amount--settled'
    : amount >= 0
      ? 'activity-amount--positive'
      : 'activity-amount--negative'
  const note = entry.expense?.note || (isSettlement ? null : 'Untitled expense')

  const typeBadgeColor = isSettlement ? '#6bf2c1' : amount >= 0 ? '#8a7bff' : '#ffb09e'
  const typeBadgeIcon = isSettlement ? '✓' : amount >= 0 ? '↑' : '↓'

  return (
    <article className="activity-card">
      <div className="activity-card__stack">
        <div className="activity-card__badges">
          <div className="activity-type-badge" style={{ background: typeBadgeColor }}>
            {typeBadgeIcon}
          </div>
          {note ? <span className="activity-card__note">{note}</span> : null}
        </div>
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
          <button type="button" className="ghost-btn" onClick={() => onViewExpense(entry.expense.id)}>
            View expense
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default ActivityCard
