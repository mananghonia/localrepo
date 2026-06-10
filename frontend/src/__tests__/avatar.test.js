import { describe, it, expect } from 'vitest'
import { getInitials, getAvatarColor, AVATAR_COLORS } from '../utils/avatar.js'

describe('getInitials', () => {
  it('returns two initials for two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('uses first two letters for single-word name', () => {
    expect(getInitials('Alice')).toBe('AL')
  })

  it('handles empty string', () => {
    expect(getInitials('')).toBe('')
  })

  it('trims leading/trailing whitespace', () => {
    expect(getInitials('  Jane Smith  ')).toBe('JS')
  })

  it('uses first two names when more than two words', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MJ')
  })

  it('returns uppercase initials', () => {
    expect(getInitials('bob marley')).toBe('BM')
  })

  it('handles single character name', () => {
    expect(getInitials('X')).toBe('X')
  })
})

describe('getAvatarColor', () => {
  it('always returns a color from the palette', () => {
    const names = ['Alice', 'Bob', 'Charlie', '', 'You', 'Test User 123']
    for (const name of names) {
      expect(AVATAR_COLORS).toContain(getAvatarColor(name))
    }
  })

  it('is deterministic — same name always gives same color', () => {
    expect(getAvatarColor('Alice')).toBe(getAvatarColor('Alice'))
    expect(getAvatarColor('Bob')).toBe(getAvatarColor('Bob'))
  })

  it('different names usually give different colors', () => {
    const colors = new Set(
      ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace'].map(getAvatarColor)
    )
    expect(colors.size).toBeGreaterThan(1)
  })

  it('handles empty string without throwing', () => {
    expect(() => getAvatarColor('')).not.toThrow()
  })
})
