import AppNav from '../components/AppNav.jsx'

const activityFeed = [
  {
    id: 'act-1',
    title: 'You paid $64.20 to Alex',
    detail: 'Ride share + snacks for team offsite',
    timestamp: '2h ago',
    status: 'posted',
  },
  {
    id: 'act-2',
    title: 'Mira added “Q3 Flights”',
    detail: 'Shared travel budget for the growth pod',
    timestamp: '5h ago',
    status: 'updated',
  },
  {
    id: 'act-3',
    title: 'Dave settled “Farmer’s Market Haul”',
    detail: 'Marked as paid back to you',
    timestamp: '1d ago',
    status: 'settled',
  },
  {
    id: 'act-4',
    title: 'You invited Leah to “Seattle Roommates”',
    detail: 'Pending acceptance',
    timestamp: '2d ago',
    status: 'pending',
  },
]

const statusToPill = {
  posted: { label: 'Expense logged', className: 'pill--success' },
  updated: { label: 'Updated', className: 'pill--soft' },
  settled: { label: 'Settled', className: 'pill--muted' },
  pending: { label: 'Pending', className: 'pill--warning' },
}

const ActivityPage = () => {
  return (
    <section className="workspace-screen">
      <AppNav />
      <header className="page-header">
        <div>
          <p className="tag-pill">Activity</p>
          <h1>Everything happening this week</h1>
          <p>Stay current on expense approvals, settlements, and invitations across your groups.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="secondary-btn">
            Export log
          </button>
        </div>
      </header>

      <div className="glass-card">
        <div className="timeline">
          {activityFeed.map((item, index) => {
            const pill = statusToPill[item.status]
            return (
              <div key={item.id} className="timeline__row">
                <div className="timeline__marker" aria-hidden>
                  <span />
                  {index !== activityFeed.length - 1 ? <i /> : null}
                </div>
                <div className="timeline__content">
                  <div className="timeline__header">
                    <h2>{item.title}</h2>
                    {pill ? <span className={`pill ${pill.className}`}>{pill.label}</span> : null}
                  </div>
                  <p>{item.detail}</p>
                  <time className="hint-text">{item.timestamp}</time>
                  <button type="button" className="ghost-btn" style={{ marginTop: '0.4rem' }}>
                    View expense
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ActivityPage
