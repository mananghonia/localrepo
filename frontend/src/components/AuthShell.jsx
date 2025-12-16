const featureTags = ['Invite-only rooms', 'Realtime splits', 'Bank-grade security']
const metrics = [
  { label: 'Balances settled', value: '$42k' },
  { label: 'Shared pots', value: '184' },
  { label: 'Avg. settle time', value: '3.2d' },
]

const AuthShell = ({ title, subtitle, children }) => (
  <div className="auth-shell">
    <section className="hero-panel">
      <p className="tag-grid">
        {featureTags.map((tag) => (
          <span key={tag} className="tag-pill">
            {tag}
          </span>
        ))}
      </p>
      <h1>Social ledgers without the spreadsheets</h1>
      <p>
        Track circles, invite friends, settle lightning fast, and plug into payments without
        sacrificing privacy. Your community finance cockpit.
      </p>
      <div className="metric-card">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-tile">
            <h3>{metric.label}</h3>
            <p className="metric-value">{metric.value}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="form-panel">
      <div className="glass-card">
        <header>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </header>
        {children}
      </div>
    </section>
  </div>
)

export default AuthShell
