import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatRelativeTime } from '../utils/formatTime.js'

const NOW = new Date('2024-06-15T12:00:00Z').getTime()

beforeEach(() => { vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

describe('formatRelativeTime', () => {
  it('returns "Just now" for null', () => {
    expect(formatRelativeTime(null)).toBe('Just now')
  })

  it('returns "Just now" for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('Just now')
  })

  it('returns "Just now" for invalid date string', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Just now')
  })

  it('returns "Just now" for timestamp less than 1 minute ago', () => {
    const ts = new Date(NOW - 30_000).toISOString()
    expect(formatRelativeTime(ts)).toBe('Just now')
  })

  it('returns minutes ago for recent timestamps', () => {
    const ts = new Date(NOW - 5 * 60_000).toISOString()
    expect(formatRelativeTime(ts)).toBe('5m ago')
  })

  it('returns hours ago for same-day timestamps', () => {
    const ts = new Date(NOW - 3 * 3600_000).toISOString()
    expect(formatRelativeTime(ts)).toBe('3h ago')
  })

  it('returns days ago for recent past days', () => {
    const ts = new Date(NOW - 2 * 86400_000).toISOString()
    expect(formatRelativeTime(ts)).toBe('2d ago')
  })

  it('returns formatted date for timestamps older than 7 days', () => {
    const ts = new Date(NOW - 10 * 86400_000).toISOString()
    const result = formatRelativeTime(ts)
    expect(result).not.toContain('ago')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns exactly "59m ago" for 59 minutes', () => {
    const ts = new Date(NOW - 59 * 60_000).toISOString()
    expect(formatRelativeTime(ts)).toBe('59m ago')
  })

  it('returns "1h ago" at exactly 60 minutes', () => {
    const ts = new Date(NOW - 60 * 60_000).toISOString()
    expect(formatRelativeTime(ts)).toBe('1h ago')
  })
})
