import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Card, Button, Badge } from '../components/UI'
import { enterDemo } from '../lib/demoMode'
import { ArrowRight, Heart, MessagesSquare, Users } from 'lucide-react'

// Demo Mode is a guided tour of the real screens, not a second product.
// Entering it sets a flag that makes apiFetch answer with canned rows, so the
// Feed, Matches and Messages components render unchanged with simulated data.
// No account is read, no session is created and nothing is written.
const STEPS = [
  {
    icon: Users,
    to: '/roommates',
    title: 'Feed',
    body: 'See who is recommended, with the reason you matched. Tap the heart to like; the cross passes.',
  },
  {
    icon: Heart,
    to: '/matches',
    title: 'Matches',
    body: 'When you both like each other, the match lands here with your compatibility score.',
  },
  {
    icon: MessagesSquare,
    to: '/messages',
    title: 'Messages',
    body: 'From a match, open the conversation and send a message. This is where you agree terms.',
  },
]

export default function DemoModePage() {
  const navigate = useNavigate()

  const start = async (to) => {
    await enterDemo()
    navigate(to)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Take the tour</h1>
            <Badge variant="amber">Demo</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-2">
            A short walk through the real screens with simulated profiles. No sign-in is
            needed, no account is read or changed, and nothing you do here is saved.
          </p>
        </div>

        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.to}>
              <Card className="p-4">
                <div className="flex items-start gap-4">
                  <span className="w-9 h-9 flex-shrink-0 rounded-full bg-brand-teal text-white flex items-center justify-center">
                    <step.icon size={18} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-muted tabular-nums">
                        Step {i + 1}
                      </span>
                      <h2 className="font-semibold text-text-primary">{step.title}</h2>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{step.body}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => start(step.to)}
                    aria-label={`Start demo at ${step.title}`}
                  >
                    Open <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <p className="text-xs text-text-muted">
          Simulated profiles only. Leaving Demo Mode returns you here and discards everything
          you saw.
        </p>
      </div>
    </Layout>
  )
}
