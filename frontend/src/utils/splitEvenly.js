const parseCents = (value) => {
  if (value === undefined || value === null || value === '') return 0
  const n = Number.parseFloat(String(value))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export const splitEvenly = (list, amountValue) => {
  if (!list.length) return list
  const totalCents = parseCents(amountValue)
  if (!totalCents) return list.map((p) => ({ ...p, amount: '' }))
  const base = Math.floor(totalCents / list.length)
  const remainder = totalCents % list.length
  return list.map((p, i) => ({
    ...p,
    amount: ((i < remainder ? base + 1 : base) / 100).toFixed(2),
  }))
}
