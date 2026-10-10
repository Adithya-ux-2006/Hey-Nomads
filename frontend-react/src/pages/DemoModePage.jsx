import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Card, Badge, Button, Spinner, EmptyState, ErrorState } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { AlertTriangle, Heart, X, MapPin, Briefcase } from 'lucide-react'

// Demo Mode never writes. Every like, match and message below lives in
// component state for the life of the visit, so a demo interaction cannot
// create a real match, a real message or a real agreement that another user
// would later believe came from a person.
export default function DemoModePage() {
  const navigate = useNavigate()
  const { data, loading, error, retry } = useAsync(
    () => apiFetch('/demo/profiles').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const profiles = data || []
  const [decided, setDecided] = useState({})
  const [matched, setMatched] = useState([])
  const [thread, setThread] = useState([])
  const [draft, setDraft] = useState('')

  const remaining = profiles.filter(p => !decided[p.id])

  // Deterministic rather than random: a reload should not feel like a different
  // product, and a test should be able to assert the outcome.
  const decide = (profile, action) => {
    setDecided(d => ({ ...d, [profile.id]: action }))
    if (action === 'like') {
      // Demo profiles always like back, which is the whole point: a new account
      // otherwise has nobody who liked it first and can never match.
      setMatched(m => [...m, profile])
      setThread(t => [...t, { from: 'them', text: `Hi! Saw we're both looking in ${profile.city}. Fancy a chat about the flat?` }])
    }
  }

  const send = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setThread(t => [...t, { from: 'me', text }])
    setDraft('')
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* The label is not decoration. Without it a demo profile reads as a
            real person, which is the exact thing this mode exists to avoid. */}
        <div className="p-4 rounded-xl border border-brand-amber/40 bg-brand-amber/10 flex gap-3">
          <AlertTriangle size={20} className="text-brand-amber flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-text-primary">Demo Mode</p>
            <p className="text-text-secondary mt-1">
              These are sample profiles, not real people. Likes, matches and chats here are
              simulated and nothing is saved to your account or anyone else's.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : error ? (
          <ErrorState what="demo profiles" error={error} onRetry={retry} />
        ) : profiles.length === 0 ? (
          <EmptyState
            title="No demo profiles are seeded"
            description="Run `npm run seed:demo` in frontend-react to load the sample accounts."
          />
        ) : (
          <>
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-3">
                Browse sample profiles
              </h2>
              {remaining.length === 0 ? (
                <EmptyState
                  title="You've seen every sample profile"
                  description="Try the simulated chat below, or go back to real recommendations."
                  action={<Button variant="secondary" onClick={() => navigate('/roommates')}>Real roommates</Button>}
                />
              ) : (
                <div className="space-y-4">
                  {remaining.map(profile => (
                    <Card key={profile.id} className="p-4">
                      <div className="flex items-start gap-4">
                        <UserAvatar src={profile.profile_image} name={profile.name} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-text-primary">
                              {profile.name}{profile.age ? `, ${profile.age}` : ''}
                            </h3>
                            <Badge variant="amber">Demo</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-text-muted mt-1">
                            {profile.occupation && (
                              <span className="flex items-center gap-1"><Briefcase size={12} /> {profile.occupation}</span>
                            )}
                            {profile.city && (
                              <span className="flex items-center gap-1"><MapPin size={12} /> {profile.city}</span>
                            )}
                            {profile.budget && (
                              <span>{Number(profile.budget).toLocaleString('en-IN')}/mo</span>
                            )}
                          </div>
                          {profile.bio && (
                            <p className="text-sm text-text-secondary mt-2 line-clamp-2">{profile.bio}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-center gap-4 mt-4">
                        <button
                          type="button"
                          onClick={() => decide(profile, 'pass')}
                          aria-label={`Pass on sample profile ${profile.name}`}
                          className="w-11 h-11 rounded-full border border-surface-border bg-white flex items-center justify-center text-text-secondary hover:text-brand-coral hover:border-brand-coral transition-colors"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(profile, 'like')}
                          aria-label={`Like sample profile ${profile.name}`}
                          className="w-11 h-11 rounded-full border border-surface-border bg-white flex items-center justify-center text-text-secondary hover:text-brand-teal hover:border-brand-teal transition-colors"
                        >
                          <Heart size={18} />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {matched.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-text-primary mb-3">
                  Simulated matches
                </h2>
                <div className="space-y-2 mb-4">
                  {matched.map(m => (
                    <div key={m.id} className="p-3 rounded-xl border border-brand-teal/30 bg-brand-teal/5 text-sm text-text-secondary">
                      Matched with <span className="font-semibold text-text-primary">{m.name}</span> (sample profile)
                    </div>
                  ))}
                </div>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-text-muted mb-3">Simulated chat</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                    {thread.map((m, i) => (
                      <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : ''}`}>
                        <p className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                          m.from === 'me'
                            ? 'bg-brand-teal text-white rounded-br-sm'
                            : 'bg-surface-muted text-text-primary rounded-bl-sm'
                        }`}>
                          {m.text}
                        </p>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={send} className="flex gap-2">
                    <input
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      aria-label="Simulated chat message"
                      placeholder="Write a message (simulated)"
                      className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-coral transition-all"
                    />
                    <Button type="submit" disabled={!draft.trim()}>Send</Button>
                  </form>
                  <p className="text-xs text-text-muted mt-2">
                    This conversation is never saved and cannot be sent to a real person.
                  </p>
                </Card>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}