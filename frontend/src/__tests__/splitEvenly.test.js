import { describe, it, expect } from 'vitest'
import { splitEvenly } from '../utils/splitEvenly.js'

const makeList = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i), name: `P${i}` }))

describe('splitEvenly', () => {
  it('returns empty array for empty list', () => {
    expect(splitEvenly([], '30')).toEqual([])
  })

  it('clears amounts when total is zero', () => {
    const result = splitEvenly(makeList(2), '0')
    expect(result.every((p) => p.amount === '')).toBe(true)
  })

  it('clears amounts when total is empty string', () => {
    const result = splitEvenly(makeList(2), '')
    expect(result.every((p) => p.amount === '')).toBe(true)
  })

  it('splits $10 evenly between 2 people → $5.00 each', () => {
    const result = splitEvenly(makeList(2), '10')
    expect(result[0].amount).toBe('5.00')
    expect(result[1].amount).toBe('5.00')
  })

  it('distributes cent remainder across first participants', () => {
    // $10 / 3 people = $3.33, $3.33, $3.34 — remainder 1 cent goes to index 0
    const result = splitEvenly(makeList(3), '10')
    const amounts = result.map((p) => p.amount)
    expect(amounts[0]).toBe('3.34')
    expect(amounts[1]).toBe('3.33')
    expect(amounts[2]).toBe('3.33')
  })

  it('total of all shares equals the input total (no rounding loss)', () => {
    const total = '7.00'
    const result = splitEvenly(makeList(3), total)
    const sum = result.reduce((acc, p) => acc + Math.round(parseFloat(p.amount) * 100), 0)
    expect(sum).toBe(700)
  })

  it('preserves existing properties on each item', () => {
    const list = [{ id: '1', name: 'Alice', isSelf: true }]
    const result = splitEvenly(list, '20')
    expect(result[0].isSelf).toBe(true)
    expect(result[0].name).toBe('Alice')
  })

  it('handles single participant — gets full amount', () => {
    const result = splitEvenly(makeList(1), '99.99')
    expect(result[0].amount).toBe('99.99')
  })

  it('handles large group without losing cents', () => {
    // $1.00 / 7 people — remainder distribution
    const result = splitEvenly(makeList(7), '1.00')
    const sum = result.reduce((acc, p) => acc + Math.round(parseFloat(p.amount) * 100), 0)
    expect(sum).toBe(100)
  })
})
