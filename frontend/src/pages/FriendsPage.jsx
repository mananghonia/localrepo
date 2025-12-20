import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AppNav from '../components/AppNav.jsx'
import FriendBreakdownModal from '../components/FriendBreakdownModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as friendsApi from '../services/friendsApi'
import { emitInvitesUpdated, INVITES_UPDATED_EVENT } from '../utils/inviteEvents'
import { FRIENDS_DATA_UPDATED_EVENT } from '../utils/realtimeStreams'

const FriendsPage = () => {
  const location = useLocation()
  const { accessToken, refreshAccessToken } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState([])
  const [invites, setInvites] = useState([])
  const [totals, setTotals] = useState({ you_owe: 0, owes_you: 0 })
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviteForm, setInviteForm] = useState({ email: '', note: '' })
  const inviteFormRef = useRef(null)
  const [activeSection, setActiveSection] = useState('friends')
  const [selectedFriend, setSelectedFriend] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('section') === 'invites' || location.hash.includes('invites')) {
      setActiveSection('invites')
    }
  }, [location.search, location.hash])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (activeSection === 'invites' && invites.length) {
      document.getElementById('invites')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeSection, invites.length])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setErrorMessage('')
    try {
      const authPayload = { accessToken, refreshAccessToken }
      const [friendsData, inviteData] = await Promise.all([
        friendsApi.fetchFriends(authPayload),
        friendsApi.fetchInvites(authPayload),
      ])
      setFriends(friendsData.friends || [])
      setTotals(friendsData.totals || { you_owe: 0, owes_you: 0 })
      setInvites(inviteData.results || [])
    } catch (error) {
      setErrorMessage(error.message)
      setStatusMessage('')
    } finally {
      setLoading(false)
    }
  }, [accessToken, refreshAccessToken])

  useEffect(() => {
    if (!accessToken) return
    loadData()
  }, [accessToken, loadData])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handler = () => {
      if (accessToken) {
        loadData()
      }
    }
    window.addEventListener(INVITES_UPDATED_EVENT, handler)
    return () => {
      window.removeEventListener(INVITES_UPDATED_EVENT, handler)
    }
  }, [accessToken, loadData])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handler = () => {
      if (accessToken) {
        loadData()
      }
    }
    window.addEventListener(FRIENDS_DATA_UPDATED_EVENT, handler)
    return () => {
      window.removeEventListener(FRIENDS_DATA_UPDATED_EVENT, handler)
    }
  }, [accessToken, loadData])

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends
    const normalized = searchQuery.trim().toLowerCase()
    return friends.filter((friend) =>
      [friend.name, friend.email, friend.username].some((value) =>
        value?.toLowerCase().includes(normalized),
      ),
    )
  }, [friends, searchQuery])

  const formatCurrency = (value) => Number(value || 0).toFixed(2)
  const youOweDisplay = formatCurrency(totals.you_owe)
  const owesYouDisplay = formatCurrency(totals.owes_you)

  const handleInviteSubmit = async (event) => {
    event.preventDefault()
    if (!inviteForm.email.trim()) {
      setErrorMessage('Please add an email address to invite.')
      return
    }
    try {
      await friendsApi.sendInvite({ accessToken, refreshAccessToken }, inviteForm)
      setInviteForm({ email: '', note: '' })
      setStatusMessage('Invite sent successfully.')
      setErrorMessage('')
      emitInvitesUpdated()
      await loadData()
    } catch (error) {
      setErrorMessage(error.message)
      setStatusMessage('')
    }
  }

  const handleInviteResponse = async (inviteId, action) => {
    try {
      await friendsApi.respondToInvite({ accessToken, refreshAccessToken }, inviteId, action)
      setStatusMessage(action === 'accept' ? 'Invite accepted.' : 'Invite dismissed.')
      setErrorMessage('')
      emitInvitesUpdated()
      await loadData()
    } catch (error) {
      setErrorMessage(error.message)
      setStatusMessage('')
    }
  }

  const scrollToInviteForm = () => {
    inviteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleFriendClick = (friend) => {
    if (!accessToken) {
      setErrorMessage('Please sign in again to view detailed balances.')
      return
    }
    setSelectedFriend(friend)
  }

  const closeFriendModal = () => {
    setSelectedFriend(null)
  }

  return (
    <section className="workspace-screen friends-screen">
      <AppNav />
      <header className="page-header">
        <div>
          <h1>People you split with</h1>
          <p>Track what you owe, what comes back to you, and where your most active groups live.</p>
        </div>
        <div className="page-header__actions">
          <button className="friends-invite-btn" type="button" onClick={scrollToInviteForm}>
            Invite friends
          </button>
        </div>
      </header>

      <div className="friends-shell">
        <article className="glass-card friends-card">
          <div className="friends-summary">
            <div>
              <p className="tag-pill pill--warning">You owe</p>
              <strong>${youOweDisplay}</strong>
            </div>
            <div>
              <p className="tag-pill pill--success">Owes you</p>
              <strong>${owesYouDisplay}</strong>
            </div>
          </div>

          {statusMessage ? <p className="status-text status-text--success">{statusMessage}</p> : null}
          {errorMessage ? <p className="status-text status-text--error">{errorMessage}</p> : null}

          <label className="input-label" htmlFor="friends-search">
            Search friends
          </label>
          <input
            id="friends-search"
            className="text-input text-input--frosted"
            type="text"
            placeholder="Search by name or username"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {invites.length ? (
            <div className="friends-invites" id="invites">
              <div className="friends-invites__header">
                Pending invitations ({invites.length})
              </div>
              <ul>
                {invites.map((invite) => (
                  <li key={invite.id} className="friends-invites__item">
                    <div>
                      <strong>{invite.inviter.name}</strong>
                      <p className="hint-text">{invite.note || 'No message provided.'}</p>
                    </div>
                    <div className="friends-invites__actions">
                      <button type="button" className="pill pill--success" onClick={() => handleInviteResponse(invite.id, 'accept')}>
                        Accept
                      </button>
                      <button type="button" className="pill pill--muted" onClick={() => handleInviteResponse(invite.id, 'reject')}>
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form ref={inviteFormRef} className="friends-invite-panel" onSubmit={handleInviteSubmit}>
            <div className="friends-invite-panel__header">
              <div>
                <p className="tag-pill pill--soft friends-invite-panel__tag">Invite via email</p>
                <h3>Send a personal invite</h3>
                <p className="hint-text">
                  Share someone&rsquo;s email and an optional note. We&rsquo;ll deliver the invite instantly.
                </p>
              </div>
            </div>
            <div className="friends-invite-panel__fields">
              <div className="field-block">
                <label className="input-label" htmlFor="invite-email">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  className="text-input text-input--frosted"
                  placeholder="friend@email.com"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div className="field-block">
                <label className="input-label" htmlFor="invite-note">
                  Add a note (optional)
                </label>
                <textarea
                  id="invite-note"
                  rows={3}
                  className="text-input text-input--frosted friends-invite-panel__note"
                  placeholder="Let them know why you&rsquo;re inviting them"
                  value={inviteForm.note}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                />
              </div>
              <button className="primary-btn friends-invite-panel__cta" type="submit">
                Send invite
              </button>
            </div>
          </form>

          <div className="friends-ledger__header">
            <h2>Friends</h2>
            <span>{filteredFriends.length || 0} total</span>
          </div>

          <ul className="friends-ledger">
            {loading ? (
              <li className="friends-ledger__empty">Loading...</li>
            ) : filteredFriends.length ? (
              filteredFriends.map((friend) => {
                const isCredit = Number(friend.balance) >= 0
                const amount = Math.abs(Number(friend.balance) || 0).toFixed(2)
                const amountClass = `friends-ledger__amount ${
                  isCredit ? 'friends-ledger__amount--positive' : 'friends-ledger__amount--negative'
                }`
                return (
                  <li
                    key={friend.id}
                    className="friends-ledger__item friends-ledger__item--action"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleFriendClick(friend)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleFriendClick(friend)
                      }
                    }}
                  >
                    <div>
                      <strong>{friend.name}</strong>
                      <p className="hint-text">@{friend.username || 'friend'} · {friend.email}</p>
                    </div>
                    <span className={amountClass}>{isCredit ? '+' : '-'}${amount}</span>
                  </li>
                )
              })
            ) : (
              <li className="friends-ledger__empty">No friends match your search.</li>
            )}
          </ul>
        </article>
      </div>
      {selectedFriend ? (
        <FriendBreakdownModal
          friend={selectedFriend}
          auth={{ accessToken, refreshAccessToken }}
          onClose={closeFriendModal}
          onSettled={loadData}
        />
      ) : null}
    </section>
  )
}

export default FriendsPage
