import { useEffect, useMemo, useState } from 'react'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as friendsApi from '../services/friendsApi'
import * as expensesApi from '../services/expensesApi'
import { emitNotificationsUpdated } from '../utils/notificationEvents'

const directorySeed = [
  { id: 'alex', name: 'Alex Garcia', username: 'alexg' },
  { id: 'mira', name: 'Mira Kapoor', username: 'mkstudio' },
  { id: 'sanjay', name: 'Sanjay Rao', username: 'ledgerrao' },
  { id: 'leah', name: 'Leah Brown', username: 'leahb' },
  { id: 'dave', name: 'Dave Kim', username: 'dkim' },
]

const sanitizeAmountInput = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  const raw = String(value).replace(/[^0-9.]/g, '')
  if (!raw) {
    return ''
  }
  const segments = raw.split('.')
  const wholeRaw = segments.shift() || ''
  const decimalsRaw = segments.join('')
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || (decimalsRaw ? '0' : wholeRaw)
  const decimals = decimalsRaw ? decimalsRaw.slice(0, 2) : ''
  if (!whole && !decimals) {
    return ''
  }
  return decimals ? `${whole || '0'}.${decimals}` : whole
}

const splitEvenly = (list, amountValue) => {
  const parseCurrencyToCents = (value) => {
    if (value === undefined || value === null || value === '') {
      return 0
    }
    const numeric = Number.parseFloat(String(value))
    if (!Number.isFinite(numeric)) {
      return 0
    }
    return Math.round(numeric * 100)
  }

  if (!list.length) {
    return list
  }

  const totalCents = parseCurrencyToCents(amountValue)
  if (!totalCents) {
    return list.map((person) => ({ ...person, amount: '' }))
  }

  const base = Math.floor(totalCents / list.length)
  const remainder = totalCents % list.length

  return list.map((person, index) => {
    const shareCents = index < remainder ? base + 1 : base
    return { ...person, amount: (shareCents / 100).toFixed(2) }
  })
}

const parseCurrencyToCents = (value) => {
  if (value === undefined || value === null || value === '') {
    return 0
  }
  const numeric = Number.parseFloat(String(value))
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return Math.round(numeric * 100)
}

const centsToNumber = (cents) => Number((cents / 100).toFixed(2))

const AddExpensePage = () => {
  const [directory, setDirectory] = useState(directorySeed)
  const [query, setQuery] = useState('')
  const [participants, setParticipants] = useState([])
  const [total, setTotal] = useState('')
  const [expenseName, setExpenseName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [autoSplit, setAutoSplit] = useState(true)
  const [feedback, setFeedback] = useState('')
  const { user, accessToken, refreshAccessToken } = useAuth()
  const selfId = user?.id || user?._id || 'self'
  const [saveStatus, setSaveStatus] = useState({ message: '', error: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadFriends = async () => {
      if (!accessToken) return
      try {
        const payload = await friendsApi.fetchFriends({ accessToken, refreshAccessToken })
        const mapped = (payload.friends || []).map((friend) => ({
          id: friend.id,
          name: friend.name,
          username: friend.username || friend.email?.split('@')[0] || '',
          email: friend.email,
        }))
        if (mapped.length) {
          setDirectory(mapped)
        }
      } catch (error) {
        console.warn('Unable to load friends directory', error)
      }
    }
    loadFriends()
  }, [accessToken, refreshAccessToken])

  const filteredDirectory = useMemo(() => {
    if (!query.trim()) return []
    const normalized = query.trim().toLowerCase()
    return directory
      .filter((person) =>
        [person.name, person.username].some(
          (value) => typeof value === 'string' && value.toLowerCase().includes(normalized),
        ),
      )
      .filter((person) => !participants.some((entry) => entry.id === person.id))
      .slice(0, 4)
  }, [query, directory, participants])

  const distributeEvenly = (list, amountValue = total) => splitEvenly(list, amountValue)

  useEffect(() => {
    if (!user) {
      return
    }

    setParticipants((prev) => {
      if (prev.some((person) => person.id === selfId)) {
        return prev
      }
      const selfEntry = {
        id: selfId,
        name: user.name || 'You',
        username: user.username || 'you',
        invited: false,
        amount: '',
        isSelf: true,
      }
      const nextList = [selfEntry, ...prev]
      return autoSplit ? splitEvenly(nextList, total) : nextList
    })
  }, [user, autoSplit, total, selfId])

  const commitParticipants = (nextList, amountValue) => {
    if (autoSplit) {
      setParticipants(distributeEvenly(nextList, amountValue))
    } else {
      setParticipants(nextList)
    }
  }

  const handleAddPerson = (person) => {
    const nextList = [...participants, { ...person, invited: false, amount: '' }]
    commitParticipants(nextList)
    setQuery('')
    setFeedback(`${person.name} added to this expense.`)
  }

  const handleTotalChange = (event) => {
    const value = event.target.value
    setTotal(value)
    if (autoSplit) {
      setParticipants((prev) => distributeEvenly(prev, value))
    }
  }

  const handleAmountEdit = (id, value) => {
    const sanitized = sanitizeAmountInput(value)
    setParticipants((prev) =>
      prev.map((person) => (person.id === id ? { ...person, amount: sanitized } : person)),
    )
    setAutoSplit(false)
  }

  const handleRemove = (id) => {
    const next = participants.filter((person) => person.id !== id)
    commitParticipants(next)
  }

  const restoreEqualSplit = () => {
    setAutoSplit(true)
    setParticipants((prev) => distributeEvenly(prev))
  }

  const handleSaveExpense = async () => {
    if (!accessToken) {
      setSaveStatus({ message: '', error: 'Please sign in again before saving.' })
      return
    }

    const trimmedName = expenseName.trim()
    if (!trimmedName) {
      setSaveStatus({ message: '', error: 'Add a name so everyone recognizes this expense.' })
      return
    }

    const normalizedTotalCents = parseCurrencyToCents(total)
    if (!normalizedTotalCents) {
      setSaveStatus({ message: '', error: 'Enter a total amount above $0.00.' })
      return
    }

    if (!participants.length) {
      setSaveStatus({ message: '', error: 'Add yourself and at least one friend to split the bill.' })
      return
    }

    const normalizedParticipants = participants
      .map((person) => ({
        user_id: person.id,
        amount_cents: parseCurrencyToCents(person.amount),
      }))
      .filter((entry) => entry.user_id === selfId || entry.amount_cents > 0)

    const hasFriendShare = normalizedParticipants.some((entry) => entry.user_id !== selfId && entry.amount_cents > 0)
    if (!hasFriendShare) {
      setSaveStatus({ message: '', error: 'Give at least one friend a share of the total.' })
      return
    }

    const assignedTotalCents = normalizedParticipants.reduce((sum, entry) => sum + entry.amount_cents, 0)
    if (Math.abs(assignedTotalCents - normalizedTotalCents) > 1) {
      setSaveStatus({ message: '', error: 'Assigned amounts must add up to the total.' })
      return
    }

    setIsSaving(true)
    setSaveStatus({ message: '', error: '' })

    try {
      await expensesApi.createExpense(
        { accessToken, refreshAccessToken },
        {
          total_amount: centsToNumber(normalizedTotalCents),
          note: trimmedName,
          group_name: groupName.trim(),
          participants: normalizedParticipants.map((entry) => ({
            user_id: entry.user_id,
            amount: centsToNumber(entry.amount_cents),
          })),
        },
      )

      setSaveStatus({ message: 'Expense saved and everyone was notified.', error: '' })
  emitNotificationsUpdated()
      setExpenseName('')
      setGroupName('')
      setTotal('')
      setQuery('')
      setAutoSplit(true)
      setParticipants((prev) => {
        const existingSelf =
          prev.find((person) => person.id === selfId) ||
          (user
            ? {
                id: selfId,
                name: user.name || 'You',
                username: user.username || 'you',
                invited: false,
                amount: '',
                isSelf: true,
              }
            : null)

        return existingSelf ? [{ ...existingSelf, amount: '' }] : []
      })
      setFeedback('')
    } catch (error) {
      const fallbackMessage = error?.message || 'Unable to save this expense right now.'
      setSaveStatus({ message: '', error: fallbackMessage })
    } finally {
      setIsSaving(false)
    }
  }

  const totalAssignedCents = participants.reduce((sum, person) => sum + parseCurrencyToCents(person.amount), 0)
  const normalizedTotalInputCents = parseCurrencyToCents(total)
  const totalsMatch = !normalizedTotalInputCents || Math.abs(totalAssignedCents - normalizedTotalInputCents) <= 1
  const hasFriendShare = participants.some((person) => !person.isSelf && parseCurrencyToCents(person.amount) > 0)
  const saveDisabled =
    isSaving ||
    !participants.length ||
    !normalizedTotalInputCents ||
    !hasFriendShare ||
    !accessToken ||
    !expenseName.trim() ||
    !totalsMatch

  const participantSummary = participants
    .map((person) => ({
      id: person.id,
      label: person.isSelf ? 'You' : person.name,
      isSelf: Boolean(person.isSelf),
    }))
    .filter((person) => person.label)

  return (
    <section className="workspace-screen add-expense-screen">
      <AppNav />
      <header className="page-header">
        <div>
          <h1>Log a new split</h1>
          <p>Search friends, scoop them into the bill, and align on who owes what.</p>
        </div>
        <div className="page-header__actions">
          <span className="pill pill--soft">Assigned ${(totalAssignedCents / 100).toFixed(2)}</span>
          <button className="primary-btn" type="button" disabled={saveDisabled} onClick={handleSaveExpense}>
            {isSaving ? 'Saving...' : 'Save expense'}
          </button>
        </div>
      </header>

      {!totalsMatch && normalizedTotalInputCents ? (
        <div className="info-banner">
          {totalAssignedCents < normalizedTotalInputCents
            ? `Add ${(Math.abs(normalizedTotalInputCents - totalAssignedCents) / 100).toFixed(2)} more to match the total.`
            : `Remove ${(Math.abs(normalizedTotalInputCents - totalAssignedCents) / 100).toFixed(2)} to match the total.`}
        </div>
      ) : null}

      {saveStatus.error ? <div className="error-banner">{saveStatus.error}</div> : null}
      {saveStatus.message ? <div className="success-banner">{saveStatus.message}</div> : null}

      <div className="expense-shell">
        <article className="glass-card expense-sheet">
          <div className="expense-sheet__grid">
            <section className="expense-block expense-step">
              <header className="expense-step__header">
                <div>
                  <div className="expense-step__kicker">
                    <span className="pill pill--warning">Step 1</span>
                  </div>
                  <h2 className="expense-step__title">Add people</h2>
                  <p className="expense-step__subtitle">Add at least one friend so you can split the total.</p>
                </div>
              </header>
              <label className="input-label" htmlFor="participant-search">
                Search friends
              </label>
              <input
                id="participant-search"
                className="text-input"
                type="text"
                placeholder="Type a name, username, or email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {filteredDirectory.length ? (
                <ul className="suggestions-list">
                  {filteredDirectory.map((person) => (
                    <li key={person.id}>
                      <div>
                        <strong>{person.name}</strong>
                        <span>@{person.username}</span>
                      </div>
                      <button type="button" className="pill pill--muted" onClick={() => handleAddPerson(person)}>
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {feedback ? <p className="hint-text" style={{ marginTop: '0.85rem' }}>{feedback}</p> : null}

              <div className="expense-step__summary">
                <div className="expense-step__summary-row">
                  <span className="input-label">In this split</span>
                  <span className="hint-text">{participantSummary.length || 0} people</span>
                </div>
                {participantSummary.length ? (
                  <div className="participants-chips" aria-label="Current participants">
                    {participantSummary.map((person) => (
                      <div
                        key={person.id}
                        className={`participant-chip pill ${person.isSelf ? 'pill--success' : 'pill--soft'}`}
                      >
                        <span>{person.label}</span>
                        {person.isSelf ? null : (
                          <button
                            type="button"
                            className="participant-chip__remove"
                            onClick={() => handleRemove(person.id)}
                            aria-label={`Remove ${person.label}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint-text">You can start by searching a friend above.</p>
                )}
              </div>
            </section>

            <section className="expense-block expense-block--split expense-step">
              <header className="expense-step__header">
                <div>
                  <div className="expense-step__kicker">
                    <span className="pill pill--warning">Step 2</span>
                  </div>
                  <h2 className="expense-step__title">Split the bill</h2>
                  <p className="expense-step__subtitle">Enter the details, then fine-tune each share.</p>
                </div>
              </header>
              <label className="input-label" htmlFor="expense-name">
                Expense name
              </label>
              <input
                id="expense-name"
                className="text-input"
                type="text"
                placeholder="Give this split a memorable name"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
              />
              <label className="input-label" htmlFor="expense-group">
                Group name (optional)
              </label>
              <input
                id="expense-group"
                className="text-input"
                type="text"
                placeholder="Add a group label so balances stay organized"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
              <label className="input-label" htmlFor="expense-total">
                Total amount
              </label>
              <input
                id="expense-total"
                className="text-input"
                type="number"
                min="0"
                placeholder="0.00"
                value={total}
                onChange={handleTotalChange}
              />
              <div className="participants-list">
                {participants.length ? (
                  participants.map((person) => (
                    <div key={person.id} className="participants-row">
                      <div className="participants-row__meta">
                        <strong>{person.name}</strong>
                        {person.invited ? <span className="pill pill--soft">Invited</span> : null}
                      </div>
                      <div className="participants-row__split">
                        <div className="participants-row__input">
                          <span>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`Amount for ${person.name}`}
                            value={person.amount}
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => handleAmountEdit(person.id, event.target.value)}
                          />
                        </div>
                        {person.isSelf ? null : (
                          <button type="button" className="pill pill--muted" onClick={() => handleRemove(person.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="hint-text">No participants yet—start by adding a friend.</p>
                )}
              </div>
              <div className="split-actions">
                <button type="button" className="btn-secondary" onClick={restoreEqualSplit} disabled={!participants.length}>
                  Equal split
                </button>
                <label className="split-toggle">
                  <input
                    type="checkbox"
                    checked={autoSplit}
                    onChange={(event) => {
                      setAutoSplit(event.target.checked)
                      if (event.target.checked) {
                        setParticipants((prev) => distributeEvenly(prev))
                      }
                    }}
                  />
                  <span>Auto-adjust when totals change</span>
                </label>
              </div>
            </section>
          </div>
        </article>
      </div>
    </section>
  )
}

export default AddExpensePage
