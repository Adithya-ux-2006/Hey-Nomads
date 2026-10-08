import { MapPin, Calendar, Handshake, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

// Three genuinely sequential steps, so they get numbered markers and read as
// a process. Elsewhere in the app numbered markers were decoration; here they
// carry real information about order.
const STEPS = [
  {
    icon: MapPin,
    title: 'Say where you are going',
    body: 'Pick your city and move-in date. We use them to weight who you meet first.',
  },
  {
    icon: Handshake,
    title: 'Get matched on how you actually live',
    body: 'Cleanliness, sleep, budget, diet, noise. You see the score and can change what matters most.',
  },
  {
    icon: Calendar,
    title: 'Talk, agree, move in',
    body: 'Message a match, draft a roommate agreement, and tick off a settling-in checklist.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      {/* One bold moment: the problem statement, full-bleed, large type.
          Everything below it stays deliberately quiet. */}
      <section className="relative overflow-hidden bg-brand-coral text-white">
        <div className="max-w-3xl mx-auto px-5 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <p className="text-base font-medium text-white/85 mb-4">
            Moving to a city where you know nobody
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold leading-[1.08] tracking-tight">
            The hard part isn't finding a flat. It's finding someone to live with.
          </h1>
          <p className="mt-6 text-lg text-white/90 max-w-xl">
            Hey Nomads matches you with people whose budget, sleep schedule and habits
            actually line up with yours, then helps you agree on the boring stuff.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-brand-coral font-bold hover:bg-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-coral"
            >
              Start matching
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border-2 border-white/70 text-white font-bold hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-coral"
            >
              Try the demo account
            </Link>
          </div>
        </div>
      </section>

      {/* How it works. A real sequence, so order is signalled honestly. */}
      <section className="max-w-3xl mx-auto w-full px-5 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
          How it works
        </h2>
        <ol className="mt-8 space-y-8">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-5">
              <div className="flex flex-col items-center flex-shrink-0">
                <span
                  className="w-9 h-9 rounded-full bg-brand-teal text-white font-bold text-sm flex items-center justify-center"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="flex-1 w-px bg-surface-border mt-2" aria-hidden="true" />
                )}
              </div>
              <div className="pb-1 min-w-0">
                <h3 className="flex items-center gap-2 font-bold text-text-primary">
                  <Icon size={18} className="text-brand-teal flex-shrink-0" aria-hidden="true" />
                  {title}
                </h3>
                <p className="mt-1.5 text-text-secondary leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Quiet closing CTA, deliberately plainer than the hero. */}
      <section className="mt-auto border-t border-surface-border bg-white">
        <div className="max-w-3xl mx-auto px-5 py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Try it without signing up</h2>
            <p className="mt-1 text-text-secondary text-sm">
              One demo account, already set up with real matches and messages.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-teal text-white font-bold hover:bg-brand-teal-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 self-start"
          >
            <Sparkles size={17} aria-hidden="true" />
            Open the demo
          </Link>
        </div>
      </section>
    </div>
  );
}