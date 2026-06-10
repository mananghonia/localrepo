import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchAnalytics, fetchSimplify } from '../services/analyticsApi.js'

const MINT   = '#6bf2c1'
const VIOLET = '#8a7bff'
const RED    = '#ff7b7b'

// ── Custom tooltip ────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label, prefix = '$' }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip__label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="analytics-tooltip__value" style={{ color: p.color || p.fill }}>
          {prefix}{Math.abs(p.value).toFixed(2)}
          {p.value < 0 ? ' (you owe)' : p.value > 0 && p.name === 'balance' ? ' (owed to you)' : ''}
        </p>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, sub }) => (
  <div className="analytics-stat">
    <span className="analytics-stat__label">{label}</span>
    <span className="analytics-stat__value" style={{ color }}>{value}</span>
    {sub && <span className="analytics-stat__sub">{sub}</span>}
  </div>
)

// ── Main page ─────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { accessToken, refreshAccessToken } = useAuth()
  const auth = { accessToken, refreshAccessToken }

  const [analytics, setAnalytics] = useState(null)
  const [simplify,  setSimplify]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchAnalytics(auth), fetchSimplify(auth)])
      .then(([a, s]) => {
        if (cancelled) return
        setAnalytics(a)
        setSimplify(s)
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load analytics.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const fmt = (n) => `$${Math.abs(n).toFixed(2)}`

  if (loading) return (
    <div className="workspace-screen">
      <AppNav />
      <p className="hint-text" style={{ textAlign: 'center', paddingTop: '4rem' }}>Loading analytics…</p>
    </div>
  )

  if (error) return (
    <div className="workspace-screen">
      <AppNav />
      <p className="error-banner" style={{ marginTop: '4rem' }}>{error}</p>
    </div>
  )

  const { summary, monthly, friends } = analytics
  const netColor = summary.net >= 0 ? MINT : RED

  return (
    <div className="workspace-screen">
      <AppNav />

      <div className="page-header">
        <h1 className="page-header__title">Analytics</h1>
        <p className="hint-text">Your spending patterns and settlement overview</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="analytics-stats">
        <StatCard
          label="Net balance"
          value={`${summary.net >= 0 ? '+' : '-'}${fmt(summary.net)}`}
          color={netColor}
          sub={summary.net >= 0 ? 'overall you are owed' : 'overall you owe'}
        />
        <StatCard label="Owed to you"  value={fmt(summary.owed_to_you)} color={MINT} sub="across all friends" />
        <StatCard label="You owe"      value={fmt(summary.you_owe)}     color={RED}  sub="across all friends" />
        <StatCard label="Total expenses" value={summary.total_expenses} color={VIOLET} sub="you're part of" />
      </div>

      {/* ── Monthly spending chart ── */}
      <div className="analytics-card">
        <h2 className="analytics-card__title">Monthly Spending</h2>
        <p className="analytics-card__sub">Your share of expenses per month</p>
        {monthly.length === 0 ? (
          <p className="hint-text">No expense data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={32}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="amount" name="amount" radius={[6, 6, 0, 0]}>
                {monthly.map((_, i) => (
                  <Cell key={i} fill={VIOLET} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Friend balances chart ── */}
      {friends.length > 0 && (
        <div className="analytics-card">
          <h2 className="analytics-card__title">Balance by Friend</h2>
          <p className="analytics-card__sub">Positive = they owe you · Negative = you owe them</p>
          <ResponsiveContainer width="100%" height={Math.max(180, friends.length * 52)}>
            <BarChart
              data={friends}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
              barSize={20}
            >
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={(v) => `$${Math.abs(v)}`} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="balance" name="balance" radius={[0, 6, 6, 0]}>
                {friends.map((f, i) => (
                  <Cell key={i} fill={f.balance >= 0 ? MINT : RED} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Smart Settlement ── */}
      <div className="analytics-card">
        <div className="analytics-simplify__header">
          <div>
            <h2 className="analytics-card__title">Smart Settlement</h2>
            <p className="analytics-card__sub">Minimum transactions needed to settle all debts</p>
          </div>
          <div className="analytics-simplify__badges">
            <span className="analytics-badge analytics-badge--dim">
              Before: <strong>{simplify.original_count}</strong>
            </span>
            <span className="analytics-badge analytics-badge--accent">
              After: <strong>{simplify.simplified_count}</strong>
            </span>
            {simplify.original_count > simplify.simplified_count && (
              <span className="analytics-badge analytics-badge--mint">
                -{simplify.original_count - simplify.simplified_count} saved
              </span>
            )}
          </div>
        </div>

        {simplify.transactions.length === 0 ? (
          <p className="hint-text" style={{ marginTop: '0.75rem' }}>
            {simplify.original_count === 0 ? 'All settled up — no outstanding balances.' : 'All balances are already optimal.'}
          </p>
        ) : (
          <ul className="analytics-txn-list">
            {simplify.transactions.map((t, i) => (
              <li key={i} className="analytics-txn">
                <span className="analytics-txn__from">{t.from_name}</span>
                <span className="analytics-txn__arrow">→</span>
                <span className="analytics-txn__to">{t.to_name}</span>
                <span className="analytics-txn__amount">${t.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}

export default AnalyticsPage
