import { describe, it, expect } from 'vitest'
import { sanitizeAmountInput } from '../utils/sanitizeAmount.js'

describe('sanitizeAmountInput', () => {
  it('returns empty string for null', () => {
    expect(sanitizeAmountInput(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(sanitizeAmountInput(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(sanitizeAmountInput('')).toBe('')
  })

  it('strips non-numeric characters', () => {
    expect(sanitizeAmountInput('$12.50')).toBe('12.50')
  })

  it('preserves valid integer', () => {
    expect(sanitizeAmountInput('42')).toBe('42')
  })

  it('preserves valid decimal', () => {
    expect(sanitizeAmountInput('9.99')).toBe('9.99')
  })

  it('truncates to 2 decimal places', () => {
    expect(sanitizeAmountInput('12.999')).toBe('12.99')
  })

  it('removes leading zeros from whole part', () => {
    expect(sanitizeAmountInput('007')).toBe('7')
  })

  it('keeps leading zero before decimal point', () => {
    expect(sanitizeAmountInput('0.50')).toBe('0.50')
  })

  it('handles value starting with a decimal point', () => {
    const result = sanitizeAmountInput('.75')
    expect(result).toBe('0.75')
  })

  it('collapses multiple decimal points', () => {
    const result = sanitizeAmountInput('1.2.3')
    expect(result).toBe('1.23')
  })

  it('handles numeric zero', () => {
    expect(sanitizeAmountInput(0)).toBe('0')
  })

  it('converts numeric input to string first', () => {
    expect(sanitizeAmountInput(15.5)).toBe('15.5')
  })
})
