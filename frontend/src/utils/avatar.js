export const getInitials = (name = '') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export const AVATAR_COLORS = [
  '#8a7bff', '#6bf2c1', '#ffb09e', '#ffce6e',
  '#a78bfa', '#34d399', '#f472b6',
]

export const getAvatarColor = (name = '') => {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash)]
}
