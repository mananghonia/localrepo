import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import AppNav from '../components/AppNav.jsx'

const DashboardPage = () => {
  const { user, isAuthenticated } = useAuth()

  const stats = useMemo(
    () => [
      { label: 'Outstanding balance', value: '$1,320', trend: '+$240 this week' },
      { label: 'You are owed', value: '$980', trend: 'Across 4 groups' },
      { label: 'Active invites', value: '6', trend: '2 waiting on approval' },
      { label: 'Payments synced', value: '$7.4k', trend: 'Stripe + UPI' },
    ],
    [],
  )

  const activity = [
    {
      title: 'Paid $240 for hill-stay Airbnb',
      meta: 'Glow Trip',
      amount: 'Split 5 ways',
    },
    { title: 'Invited Mira to Product House', meta: 'Creator pod', amount: 'Pending' },
    { title: 'UPI payout received', meta: 'Room 302', amount: '+$180' },
  ]


  return (
    <section className="dashboard-grid">
      <AppNav />
      <div className="dash-header">
        <div>
          <p className="tag-pill" style={{ display: 'inline-flex' }}>
            Multi-ledger overview
          </p>
          <h1 style={{ margin: '0.4rem 0 0' }}>Hey {user?.name || 'there'}, everything balanced?</h1>
          <p style={{ margin: '0.4rem 0 0', color: 'rgba(255,255,255,0.65)' }}>
            Keep tabs on every invite, contribution, and reimbursement from one intentional surface.
          </p>
        </div>
          <div className="dash-presence">
            {isAuthenticated ? (
              <>
                <span className="dash-presence__label">Signed in as</span>
                <strong>{user?.name || user?.username || 'Member'}</strong>
              </>
            ) : (
              <>
                <span className="dash-presence__label">Guest preview</span>
                <p>Browse the sample workspace, then hit Log in to connect your ledger.</p>
              </>
            )}
          </div>
      </div>

      <div className="dash-cards">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p className="stat-label">{stat.label}</p>
            <h2 style={{ margin: '0.4rem 0', fontSize: '2rem' }}>{stat.value}</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0 }}>{stat.trend}</p>
          </article>
        ))}
      </div>

      <div className="activity-log">
        <header style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Latest signals</h3>
          <p style={{ margin: '0.2rem 0 0', color: 'rgba(255,255,255,0.65)' }}>
            Invite approvals, shared expenses, and payouts drop here in realtime.
          </p>
        </header>
        {activity.map((item) => (
          <div key={item.title} className="activity-item">
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{item.title}</p>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>{item.meta}</span>
            </div>
            <strong>{item.amount}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export default DashboardPage
