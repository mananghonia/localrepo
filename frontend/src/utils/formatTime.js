export const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Just now'
  const ts = new Date(isoString)
  const diffMs = Date.now() - ts.getTime()
  if (Number.isNaN(diffMs)) return 'Just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return ts.toLocaleDateString()
}
