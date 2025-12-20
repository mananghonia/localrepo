import PropTypes from 'prop-types'
const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Just now'
  const timestamp = new Date(isoString)
  const diffMs = Date.now() - timestamp.getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return timestamp.toLocaleDateString()
}

const NotificationTray = ({
  notifications,
  unreadCount,
  inviteCount,
  loading,
  error,
  onClose,
  onMarkRead,
  onMarkAll,
  onViewInvites,
  className,
}) => {
  return (
    <div className={`notification-tray${className ? ` ${className}` : ''}`} role="dialog" aria-label="Notifications">
      <div className="notification-tray__header">
        <div>
          <strong>Notifications</strong>
          <p className="hint-text">{unreadCount ? `${unreadCount} unread` : 'You are up to date'}</p>
        </div>
        <div className="notification-tray__header-actions">
          <button type="button" className="notification-tray__sweep" onClick={onMarkAll} disabled={!unreadCount || loading}>
            Mark all read
          </button>
          <button type="button" className="notification-tray__close" onClick={onClose} aria-label="Close notifications">
            ×
          </button>
        </div>
      </div>
      <div className="notification-tray__body">
        {inviteCount ? (
          <div className="notification-tray__invite">
            <span>You have {inviteCount} pending friend invite{inviteCount > 1 ? 's' : ''}.</span>
            <button type="button" className="pill pill--soft" onClick={onViewInvites}>
              View invites
            </button>
          </div>
        ) : null}
        {loading ? <p className="notification-tray__state">Loading…</p> : null}
        {error ? <p className="notification-tray__state notification-tray__state--error">{error}</p> : null}
        {!loading && !error && !notifications.length ? (
          <p className="notification-tray__state">Nothing new yet. Add an expense or settle a balance.</p>
        ) : null}
        <ul>
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`notification-tray__item${notification.is_read ? ' notification-tray__item--read' : ' notification-tray__item--unread'}`}
            >
              <div className="notification-tray__item-main">
                <span className="notification-tray__dot" aria-hidden />
                <div>
                  <p className="notification-tray__title">{notification.title}</p>
                  <p className="notification-tray__body-text">{notification.body}</p>
                </div>
              </div>
              <div className="notification-tray__item-meta">
                {!notification.is_read ? (
                  <button type="button" className="notification-tray__mark" onClick={() => onMarkRead(notification.id)}>
                    Mark
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

NotificationTray.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      body: PropTypes.string,
      created_at: PropTypes.string,
      is_read: PropTypes.bool,
    }),
  ),
  unreadCount: PropTypes.number,
  inviteCount: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onMarkAll: PropTypes.func.isRequired,
  onViewInvites: PropTypes.func.isRequired,
  className: PropTypes.string,
}

NotificationTray.defaultProps = {
  notifications: [],
  unreadCount: 0,
  inviteCount: 0,
  loading: false,
  error: '',
  className: '',
}

export default NotificationTray
