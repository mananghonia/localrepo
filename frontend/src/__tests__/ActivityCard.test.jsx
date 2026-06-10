import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActivityCard from '../components/ActivityCard.jsx'

const baseEntry = {
  id: 'e1',
  summary: 'Alice added "Dinner"',
  detail: 'You owe $15.00 to Alice for Dinner.',
  status: 'due',
  amount: -15.0,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  expense: { id: 'exp1', note: 'Dinner' },
}

describe('ActivityCard', () => {
  it('renders summary text', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    expect(screen.getByText('Alice added "Dinner"')).toBeInTheDocument()
  })

  it('renders detail text', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    expect(screen.getByText(/You owe \$15\.00/)).toBeInTheDocument()
  })

  it('shows negative amount for debt', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    expect(screen.getByText(/-\$15\.00/)).toBeInTheDocument()
  })

  it('shows "You owe" intent label for negative amount', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    expect(screen.getByText('You owe')).toBeInTheDocument()
  })

  it('shows "They owe you" for positive amount', () => {
    const entry = { ...baseEntry, amount: 20.0, status: 'credited' }
    render(<ActivityCard entry={entry} onViewExpense={() => {}} />)
    expect(screen.getByText('They owe you')).toBeInTheDocument()
  })

  it('shows "Settled" for settlement status', () => {
    const entry = { ...baseEntry, amount: 0, status: 'settled' }
    render(<ActivityCard entry={entry} onViewExpense={() => {}} />)
    expect(screen.getByText('Settled')).toBeInTheDocument()
  })

  it('shows expense note pill', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    expect(screen.getByText('Dinner')).toBeInTheDocument()
  })

  it('shows "View expense" button when expense id is present', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    expect(screen.getByRole('button', { name: /view expense/i })).toBeInTheDocument()
  })

  it('calls onViewExpense with expense id when button clicked', () => {
    const onView = vi.fn()
    render(<ActivityCard entry={baseEntry} onViewExpense={onView} />)
    fireEvent.click(screen.getByRole('button', { name: /view expense/i }))
    expect(onView).toHaveBeenCalledWith('exp1')
  })

  it('does not show "View expense" button when no expense id', () => {
    const entry = { ...baseEntry, expense: null }
    render(<ActivityCard entry={entry} onViewExpense={() => {}} />)
    expect(screen.queryByRole('button', { name: /view expense/i })).not.toBeInTheDocument()
  })

  it('shows peach type badge for you-owe entries', () => {
    render(<ActivityCard entry={baseEntry} onViewExpense={() => {}} />)
    const badge = document.querySelector('.activity-type-badge')
    // jsdom normalizes hex to rgb(); #ffb09e → rgb(255, 176, 158)
    expect(badge.style.background).toEqual('rgb(255, 176, 158)')
  })

  it('shows violet type badge for owed-to-you entries', () => {
    const entry = { ...baseEntry, amount: 10, status: 'credited' }
    render(<ActivityCard entry={entry} onViewExpense={() => {}} />)
    const badge = document.querySelector('.activity-type-badge')
    // #8a7bff → rgb(138, 123, 255)
    expect(badge.style.background).toEqual('rgb(138, 123, 255)')
  })

  it('shows mint type badge for settlements', () => {
    const entry = { ...baseEntry, amount: 0, status: 'settled' }
    render(<ActivityCard entry={entry} onViewExpense={() => {}} />)
    const badge = document.querySelector('.activity-type-badge')
    // #6bf2c1 → rgb(107, 242, 193)
    expect(badge.style.background).toEqual('rgb(107, 242, 193)')
  })
})
