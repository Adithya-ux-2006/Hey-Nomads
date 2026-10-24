import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Card, Button, Badge } from '../components/UI'
import { enterDemo } from '../lib/demoMode'
import { startTour, TOUR_STEPS } from '../lib/tour'
import { Play } from 'lucide-react'

// Demo Mode is a guided tour of the real screens, not a second product.
// Entering it sets a flag that makes apiFetch answer with canned rows, so the
// Feed, Matches and Messages components render unchanged with simulated data.
// No account is read, no session is created and nothing is written.
//
// This page is only the launcher. The walkthrough itself is a coach-mark that
// sits on the real interface (TourOverlay), so opening a step from here just
// starts the tour - the guidance comes from the overlay, not from this page.
export default function DemoModePage() {
  const navigate = useNavigate()

  const start = async () => {
    await enterDemo()
    startTour(0)
    navigate(TOUR_STEPS[0].path)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Take the walkthrough</h1>
            <Badge variant="amber">Demo</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-2">
            A guided walk through the real screens with simulated profiles. A coach-mark
            tells you what to do and what to avoid at each step. No sign-in is needed, no
            account is read or changed, and demo lists are saved in this tab only.
          </p>
        </div>

        <Button onClick={start} className="w-full sm:w-auto">
          <Play size={16} aria-hidden="true" /> Start the walkthrough
        </Button>

        <ol className="space-y-3">
          {TOUR_STEPS.map((step, i) => (
            <li key={step.path}>
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted tabular-nums">
                    Step {i + 1}
                  </span>
                  <h2 className="font-semibold text-text-primary">{step.title}</h2>
                </div>
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-brand-teal">Do: </span>
                  {step.do}
                </p>
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-brand-coral">Don't: </span>
                  {step.dont}
                </p>
              </Card>
            </li>
          ))}
        </ol>

        <p className="text-xs text-text-muted">
          Simulated profiles only. Leaving the walkthrough discards everything you saw.
        </p>
      </div>
    </Layout>
  )
}
