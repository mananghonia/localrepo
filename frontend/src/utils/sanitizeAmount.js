export const sanitizeAmountInput = (value) => {
  if (value === undefined || value === null) return ''
  const raw = String(value).replace(/[^0-9.]/g, '')
  if (!raw) return ''
  const segments = raw.split('.')
  const wholeRaw = segments.shift() || ''
  const decimalsRaw = segments.join('')
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || (decimalsRaw ? '0' : wholeRaw)
  const decimals = decimalsRaw ? decimalsRaw.slice(0, 2) : ''
  if (!whole && !decimals) return ''
  return decimals ? `${whole || '0'}.${decimals}` : whole
}
