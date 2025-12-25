import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as friendsApi from '../services/friendsApi'
import * as expensesApi from '../services/expensesApi'

const currencyFormatters = new Map()

const getCurrencyFormatter = (digits = 0) => {
  if (!currencyFormatters.has(digits)) {
    currencyFormatters.set(
      digits,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    )
  }
  return currencyFormatters.get(digits)
}

const formatCurrency = (value, { signed = false, digits = 0 } = {}) => {
  const amount = Number(value) || 0
  const formatter = getCurrencyFormatter(digits)
  const formatted = formatter.format(Math.abs(amount))
  if (amount < 0) {
    return `-${formatted}`
  }
  if (signed && amount > 0) {
    return `+${formatted}`
  }
  return formatted
}

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const RELATIVE_TIME_STEPS = [
  { limit: 60, unit: 'second', divisor: 1 },
  { limit: 3600, unit: 'minute', divisor: 60 },
  { limit: 86400, unit: 'hour', divisor: 3600 },
  { limit: 604800, unit: 'day', divisor: 86400 },
  { limit: 2629800, unit: 'week', divisor: 604800 },
  { limit: 31557600, unit: 'month', divisor: 2629800 },
  { limit: Infinity, unit: 'year', divisor: 31557600 },
]

const formatRelativeTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(deltaSeconds)
  for (const step of RELATIVE_TIME_STEPS) {
    if (absoluteSeconds < step.limit) {
      const rounded = Math.round(deltaSeconds / step.divisor)
      return RELATIVE_TIME_FORMATTER.format(rounded, step.unit)
    }
  }
  return ''
}

const buildInitials = (name = '') => {
  const parts = name
    .split(' ')
    .map((segment) => segment.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
  return parts.join('').toUpperCase() || '??'
}

const decorateFriends = (friends = []) =>
  friends
    .map((friend, index) => {
      const balance = Number(friend.balance || 0)
      return {
        id: friend.id || `friend-${index}`,
        name: friend.name || friend.email || 'Friend',
        initials: buildInitials(friend.name || friend.email || 'Friend'),
        balance,
        direction: balance >= 0 ? 'owes_you' : 'you_owe',
      }
    })
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 4)

const computeExpenseDelta = (expense, viewerId) => {
  if (!expense || !viewerId) return 0
  const participants = expense.participants || []
  const viewerEntry = participants.find((part) => part?.user?.id === viewerId)
  if (!viewerEntry) return 0
  if (viewerEntry.is_payer) {
    return participants
      .filter((part) => part?.user?.id !== viewerId)
      .reduce((sum, part) => sum + Number(part.amount || 0), 0)
  }
  return -Number(viewerEntry.amount || 0)
}

const buildGroupSummaries = (expenses = [], viewerId) => {
  if (!viewerId) return []
  const map = new Map()
  expenses.forEach((expense) => {
    const label = (expense.group_name || expense.note || 'Personal split').trim() || 'Personal split'
    const delta = computeExpenseDelta(expense, viewerId)
    if (!delta) return
    const key = label.toLowerCase()
    if (!map.has(key)) {
      map.set(key, {
        label,
        amount: 0,
        members: new Set(),
      })
    }
    const entry = map.get(key)
    entry.amount += delta
    ;(expense.participants || []).forEach((part) => {
      if (part?.user?.name) {
        entry.members.add(part.user.name)
      }
    })
  })
  return Array.from(map.values())
    .map((entry) => ({
      label: entry.label,
      amount: entry.amount,
      members: entry.members.size,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 3)
}

const buildStats = (friendsPayload, invitesPayload, expensesPayload) => {
  const totals = friendsPayload?.totals || {}
  const outstanding = (totals.owes_you || 0) - (totals.you_owe || 0)
  const invitesCount = Number(invitesPayload?.count ?? 0)
  const expenses = expensesPayload?.results || []
  const paymentsTotal = expenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0)
  const activeGroups = new Set(
    expenses.map((expense) => (expense.group_name || 'Personal split').trim() || 'Personal split'),
  )
  const groupsCount = activeGroups.size
  return [
    {
      label: 'Outstanding balance',
      kind: 'currency',
      signed: true,
      value: outstanding,
      detail: `${formatCurrency(totals.owes_you || 0)} owed • ${formatCurrency(totals.you_owe || 0)} due`,
    },
    {
      label: 'You are owed',
      kind: 'currency',
      value: totals.owes_you || 0,
      detail: groupsCount
        ? `${groupsCount} active ${groupsCount === 1 ? 'group' : 'groups'}`
        : 'Start a group from any split',
    },
    {
      label: 'Active invites',
      kind: 'count',
      value: invitesCount,
      detail: invitesCount ? `${invitesCount} waiting on approval` : 'All invitations answered',
    },
    {
      label: 'Payments synced',
      kind: 'currency',
      value: paymentsTotal,
      detail: expenses.length
        ? `${expenses.length} recent expense${expenses.length === 1 ? '' : 's'}`
        : 'Log your first expense',
    },
  ]
}

const mapActivityEntries = (activityPayload) =>
  (activityPayload?.results || [])
    .slice(0, 4)
    .map((entry, index) => ({
      id: entry.id || `activity-${index}`,
      summary: entry.summary,
      detail: entry.detail,
      status: entry.status,
      amount: Number(entry.amount || 0),
      createdAt: entry.created_at,
    }))

const SAMPLE_USER_ID = 'demo-user'

const SAMPLE_FRIENDS_PAYLOAD = {
  friends: [
    { id: 'friend-1', name: 'Sarah Chen', balance: 120 },
    { id: 'friend-2', name: 'Mike Ross', balance: -45 },
    { id: 'friend-3', name: 'Emma Wilson', balance: 230 },
    { id: 'friend-4', name: 'Alex Turner', balance: 89 },
  ],
  totals: {
    you_owe: 45,
    owes_you: 1460,
  },
}

const SAMPLE_INVITES_PAYLOAD = {
  count: 2,
  results: [],
}

const SAMPLE_EXPENSES_PAYLOAD = {
  results: [
    {
      id: 'expense-1',
      group_name: 'Glow Trip',
      note: 'Paid Airbnb',
      total_amount: 240,
      payer: { id: SAMPLE_USER_ID, name: 'Manan Ghonia' },
      participants: [
        { user: { id: SAMPLE_USER_ID, name: 'Manan Ghonia' }, amount: 0, is_payer: true },
        { user: { id: 'friend-1', name: 'Sarah Chen' }, amount: 120, is_payer: false },
        { user: { id: 'friend-2', name: 'Mike Ross' }, amount: 120, is_payer: false },
      ],
    },
    {
      id: 'expense-2',
      group_name: 'Room 502',
      note: 'Utilities',
      total_amount: 120,
      payer: { id: 'friend-2', name: 'Mike Ross' },
      participants: [
        { user: { id: 'friend-2', name: 'Mike Ross' }, amount: 80, is_payer: true },
        { user: { id: SAMPLE_USER_ID, name: 'Manan Ghonia' }, amount: 40, is_payer: false },
      ],
    },
    {
      id: 'expense-3',
      group_name: 'Creator pod',
      note: 'Studio gear',
      total_amount: 456,
      payer: { id: SAMPLE_USER_ID, name: 'Manan Ghonia' },
      participants: [
        { user: { id: SAMPLE_USER_ID, name: 'Manan Ghonia' }, amount: 0, is_payer: true },
        { user: { id: 'friend-3', name: 'Emma Wilson' }, amount: 230, is_payer: false },
        { user: { id: 'friend-4', name: 'Alex Turner' }, amount: 226, is_payer: false },
      ],
    },
  ],
}

const SAMPLE_ACTIVITY_PAYLOAD = {
  results: [
    {
      id: 'activity-1',
      summary: 'Paid $240 for hill-stay Airbnb',
      detail: 'Glow Trip • Split 5 ways',
      status: 'credited',
      amount: 240,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'activity-2',
      summary: 'Invited Mira to Product House',
      detail: 'Creator pod • Pending',
      status: 'pending',
      amount: 0,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'activity-3',
      summary: 'UPI payout received',
      detail: 'Room 502 • Settlement',
      status: 'settled',
      amount: 180,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
}

const DashboardPage = () => {
  const { user, isAuthenticated, accessToken, refreshAccessToken } = useAuth()
  const viewerId = isAuthenticated ? user?.id : SAMPLE_USER_ID

  const [stats, setStats] = useState(() =>
    buildStats(SAMPLE_FRIENDS_PAYLOAD, SAMPLE_INVITES_PAYLOAD, SAMPLE_EXPENSES_PAYLOAD),
  )
  const [friends, setFriends] = useState(() => decorateFriends(SAMPLE_FRIENDS_PAYLOAD.friends))
  const [groups, setGroups] = useState(() =>
    buildGroupSummaries(SAMPLE_EXPENSES_PAYLOAD.results, SAMPLE_USER_ID),
  )
  const [activity, setActivity] = useState(() => mapActivityEntries(SAMPLE_ACTIVITY_PAYLOAD))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setStats(buildStats(SAMPLE_FRIENDS_PAYLOAD, SAMPLE_INVITES_PAYLOAD, SAMPLE_EXPENSES_PAYLOAD))
      setFriends(decorateFriends(SAMPLE_FRIENDS_PAYLOAD.friends))
      setGroups(buildGroupSummaries(SAMPLE_EXPENSES_PAYLOAD.results, SAMPLE_USER_ID))
      setActivity(mapActivityEntries(SAMPLE_ACTIVITY_PAYLOAD))
      setLoading(false)
      setError('')
      return
    }

    let ignore = false
    const auth = { accessToken, refreshAccessToken }

    setLoading(true)
    setError('')

    Promise.allSettled([
      friendsApi.fetchFriends(auth),
      friendsApi.fetchInvites(auth),
      expensesApi.fetchExpenses(auth),
      expensesApi.fetchActivity(auth),
    ])
      .then((results) => {
        if (ignore) return
        const [friendsResult, invitesResult, expensesResult, activityResult] = results

        const friendsPayload = friendsResult.status === 'fulfilled' ? friendsResult.value : null
        const invitesPayload = invitesResult.status === 'fulfilled' ? invitesResult.value : null
        const expensesPayload = expensesResult.status === 'fulfilled' ? expensesResult.value : null
        const activityPayload = activityResult.status === 'fulfilled' ? activityResult.value : null

        setStats(buildStats(friendsPayload, invitesPayload, expensesPayload))
        setFriends(decorateFriends(friendsPayload?.friends || []))
        setGroups(buildGroupSummaries(expensesPayload?.results || [], viewerId))
        setActivity(mapActivityEntries(activityPayload))

        const failure = results.find((entry) => entry.status === 'rejected')
        setError(failure?.reason?.message || (failure?.reason ? String(failure.reason) : ''))
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [isAuthenticated, accessToken, refreshAccessToken, viewerId])

  const heroName = user?.name || 'there'

  const renderStatValue = (stat) => {
    if (stat.kind === 'currency') {
      return formatCurrency(stat.value, { signed: stat.signed })
    }
    if (stat.kind === 'count') {
      return Number(stat.value || 0).toLocaleString('en-US')
    }
    return stat.value
  }

  return (
    <section className="dashboard-grid">
      <AppNav />
      <div className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <span className="dash-pill">Multi-ledger overview</span>
          <h1>
            Hey {heroName}, everything balanced? <span role="img" aria-label="wave">👋</span>
          </h1>
          <p>
            Keep tabs on every invite, contribution, and reimbursement from one intentional surface.
          </p>
          {!isAuthenticated ? (
            <p className="dashboard-hero__hint">
              Preview live Balance Studio UI, then sign in to replace this data with your own.
            </p>
          ) : null}
        </div>
        <div className="dashboard-hero__meta">
          <span className="sync-chip">
            {isAuthenticated ? (loading ? 'Syncing workspace' : 'Workspace live') : 'Guest preview'}
          </span>
          <p>
            {isAuthenticated
              ? `Signed in as ${user?.email || user?.username || 'member'}.`
              : 'Connect your account to see up-to-the-minute ledgers and invites.'}
          </p>
          {error ? <div className="error-banner">{error}</div> : null}
        </div>
      </div>

      <div className="dash-metrics">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p className="stat-label">{stat.label}</p>
            <p className="stat-card__value">{renderStatValue(stat)}</p>
            <p className="stat-card__detail">{stat.detail}</p>
          </article>
        ))}
      </div>

      <div className="dash-panels">
        <section className="panel-card friends-panel">
          <header className="panel-header">
            <div>
              <p className="panel-kicker">Friends</p>
              <h3>Active connections</h3>
            </div>
            <Link to="/friends" className="panel-link">
              View all friends
            </Link>
          </header>
          {friends.length ? (
            <ul className="friends-list">
              {friends.map((friend) => (
                <li key={friend.id} className="friend-row">
                  <div className="friend-row__identity">
                    <span className="friend-avatar">{friend.initials}</span>
                    <div>
                      <p>{friend.name}</p>
                      <span>{friend.direction === 'owes_you' ? 'owes you' : 'you owe'}</span>
                    </div>
                  </div>
                  <strong
                    className={`friend-amount ${
                      friend.balance >= 0 ? 'friend-amount--positive' : 'friend-amount--negative'
                    }`}
                  >
                    {formatCurrency(friend.balance, { signed: true })}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">
              No balances yet. Invite a friend to start splitting expenses.
            </p>
          )}
        </section>
        <section className="panel-card groups-panel">
          <header className="panel-header">
            <div>
              <p className="panel-kicker">Active groups</p>
              <h3>Shared expense circles</h3>
            </div>
            <Link to="/add-expense" className="ghost-pill">
              Create group
            </Link>
          </header>
          {groups.length ? (
            <ul className="groups-list">
              {groups.map((group) => (
                <li key={group.label} className="group-row">
                  <div>
                    <p>{group.label}</p>
                    <span>{group.members ? `${group.members} members` : 'Expense activity'}</span>
                  </div>
                  <div className="group-row__meta">
                    <strong className={group.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                      {formatCurrency(group.amount, { signed: true })}
                    </strong>
                    <span className="text-link">View details →</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">Log an expense to activate your first group.</p>
          )}
        </section>
      </div>

      <section className="panel-card signals-card">
        <div className="signals-card__header">
          <div>
            <p className="panel-kicker">Latest signals</p>
            <h3>Invite approvals, shared expenses, and payouts drop here in realtime.</h3>
          </div>
          <Link to="/activity" className="panel-link">
            View all
          </Link>
        </div>
        {activity.length ? (
          <ul className="signals-list">
            {activity.map((entry) => {
              const infoLine = [entry.detail, formatRelativeTime(entry.createdAt)]
                .filter(Boolean)
                .join(' • ')
              const statusClass = entry.status
                ? entry.status.replace(/\s+/g, '-').toLowerCase()
                : 'default'
              return (
                <li key={entry.id} className="signal-row">
                  <div className={`signal-icon signal-icon--${statusClass}`} aria-hidden="true" />
                  <div className="signal-row__body">
                    <p>{entry.summary}</p>
                    <span>{infoLine}</span>
                  </div>
                  <div className="signal-row__meta">
                    <span className={`signal-status signal-status--${statusClass}`}>
                      {entry.status ? entry.status.replace(/_/g, ' ') : 'update'}
                    </span>
                    <strong className={entry.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                      {formatCurrency(entry.amount, { signed: true })}
                    </strong>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="panel-empty">
            No activity yet. Split an expense to see realtime signals.
          </p>
        )}
      </section>
    </section>
  )
}

export default DashboardPage
