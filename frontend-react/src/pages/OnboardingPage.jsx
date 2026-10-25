import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { InlineError } from '../components/UI';
import { validateDob, MIN_AGE } from '../../api/age.mjs';

const INTERESTS = [
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'food', label: 'Food', icon: '🍕' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'technology', label: 'Technology', icon: '💻' },
  { id: 'arts', label: 'Arts', icon: '🎨' },
  { id: 'reading', label: 'Reading', icon: '📚' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'cooking', label: 'Cooking', icon: '👨‍🍳' },
  { id: 'hiking', label: 'Hiking', icon: '🥾' },
  { id: 'yoga', label: 'Yoga', icon: '🧘' },
  { id: 'movies', label: 'Movies', icon: '🎬' },
  { id: 'podcasts', label: 'Podcasts', icon: '🎙️' },
  { id: 'volunteering', label: 'Volunteering', icon: '🤝' },
];

// What this choice does to the feed, stated the moment it is made. The
// two-sided gender filter is a hard rule, so the consequence belongs where
// the choice happens - not first discovered as an empty Discover page.
const PREF_SEE = {
  female: "You'll only see women's accounts in Discover and Roommates.",
  male: "You'll only see men's accounts in Discover and Roommates.",
  all: "You'll see accounts of every gender.",
  unspecified: "You'll see everyone you're compatible with.",
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  // Served by the API so the list here cannot drift from the cities table.
  // A hardcoded copy had already gone out of sync and was missing a city the
  // rest of the app knew about.
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [data, setData] = useState({
    date_of_birth: '',
    gender: '',
    preferred_gender: 'unspecified',
    looking_for: 'both',
    moving_to: '',
    moving_date: '',
    budget: 15000,
    flat_type: 'shared',
    cleanliness: 3,
    sleep_time: 'flexible',
    social_level: 'moderate',
    smoking: 'no',
    drinking: 'no',
    diet: 'veg',
    interests: [],
  });
  // DOB is validated in the module the API also uses, so onboarding and the
  // profile editor can never disagree about what counts as a valid date or a
  // legal age. The server re-validates anyway; this is the "tell them now
  // instead of after submit" copy.
  const dobCheck = data.date_of_birth ? validateDob(data.date_of_birth) : null;
  const dobInvalid = dobCheck != null && !dobCheck.ok;
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let live = true;
    apiFetch('/cities')
      .then(rows => { if (live) setCities(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (live) setCities([]); })
      .finally(() => { if (live) setCitiesLoading(false); });
    return () => { live = false; };
  }, []);

  const update = (key, value) => setData(prev => ({ ...prev, [key]: value }));
  const toggleInterest = (id) => {
    setData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id]
    }));
  };

  const steps = [
    // Step 0: About you. Age is derived from DOB on the server, so this step
    // must exist before matching can run a gender filter or show an age: it is
    // the only place either is collected, and leaving it out meant a new
    // account was unmatchable until it found Edit Profile by accident.
    {
      title: 'About you',
      subtitle: 'Your age and who you want to meet',
      content: (
        <div className="space-y-6 mt-6">
          <div>
            <label htmlFor="ob-dob" className="text-sm font-semibold text-text-primary mb-2 block">
              Date of birth
            </label>
            <input
              id="ob-dob"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={data.date_of_birth}
              onChange={e => update('date_of_birth', e.target.value)}
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral transition-all"
            />
            <p className="text-xs text-text-muted mt-1.5">
              We calculate your age from this; you never type a number. You must be {MIN_AGE} or over.
            </p>
            {dobInvalid && (
              <p className="text-sm text-status-error mt-2" role="alert">{dobCheck.error}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-text-primary mb-2 block">Gender</label>
            <div className="flex flex-wrap gap-2">
              {[{ v: 'female', l: 'Female' }, { v: 'male', l: 'Male' }, { v: 'nonbinary', l: 'Non-binary' }, { v: 'other', l: 'Other' }].map(o => (
                <button key={o.v} type="button" onClick={() => update('gender', o.v)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data.gender === o.v ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-text-primary mb-2 block">I'd like to meet</label>
            <div className="flex flex-wrap gap-2">
              {[{ v: 'female', l: 'Women' }, { v: 'male', l: 'Men' }, { v: 'all', l: 'Everyone' }, { v: 'unspecified', l: "I'm not sure yet" }].map(o => (
                <button key={o.v} type="button" onClick={() => update('preferred_gender', o.v)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data.preferred_gender === o.v ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-1.5" aria-live="polite">
              {PREF_SEE[data.preferred_gender] || PREF_SEE.unspecified}
            </p>
            <p className="text-xs text-text-muted mt-1">
              Both sides have to be open to it, so you only ever see people you could both meet.
            </p>
          </div>
        </div>
      ),
    },
    // Step 1: What are you looking for?
    {
      title: 'What are you looking for?',
      subtitle: 'Help us personalize your experience',
      content: (
        <div className="grid grid-cols-1 gap-4 mt-6">
          {[
            { value: 'roommate', label: 'Find a Roommate', desc: 'I need someone to live with', icon: '🏠' },
            { value: 'community', label: 'Find Community', desc: 'I want to meet people', icon: '👥' },
            { value: 'both', label: 'Both', desc: 'Roommate + community', icon: '🌟' },
          ].map(opt => (
            <button key={opt.value} onClick={() => update('looking_for', opt.value)}
              className={`p-5 rounded-2xl border text-left transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2 ${data.looking_for === opt.value ? 'border-brand-coral bg-brand-coral/5 shadow-card' : 'border-surface-border bg-white hover:border-brand-coral/40'}`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{opt.icon}</span>
                <div>
                  <div className="font-bold text-text-primary">{opt.label}</div>
                  <div className="text-sm text-text-secondary">{opt.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    // Step 1: Where are you moving?
    {
      title: 'Where are you moving?',
      subtitle: 'Tell us your destination',
      content: (
        <div className="space-y-5 mt-6">
          <div>
            <label className="text-sm font-semibold text-text-primary mb-2 block">City</label>
            {citiesLoading ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-9 w-24 rounded-full" />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cities.map(city => (
                  <button key={city.id} type="button" onClick={() => update('moving_to', city.name)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data.moving_to === city.name ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral'}`}>
                    {city.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-text-muted mt-2">
              Resources and guides on your checklist are matched to this city.
            </p>
          </div>
          <div>
            <label htmlFor="ob-date" className="text-sm font-semibold text-text-primary mb-2 block">Moving date</label>
            <input id="ob-date" type="date" value={data.moving_date} onChange={e => update('moving_date', e.target.value)}
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral transition-all" />
          </div>
        </div>
      ),
    },
    // Step 2: Budget & Housing
    {
      title: 'What kind of place?',
      subtitle: 'Budget and housing preferences',
      content: (
        <div className="space-y-6 mt-6">
          <div>
            {/* A plain number, not a rupee-pinned slider. min=5000/max=100000
                made every non-Indian budget unselectable. */}
            <label htmlFor="ob-budget" className="text-sm font-semibold text-text-primary mb-2 block">
              Monthly budget: {data.budget.toLocaleString()}
            </label>
            <input id="ob-budget" type="number" min={0} step={50} value={data.budget}
              onChange={e => update('budget', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral transition-all" />
            <p className="text-xs text-text-muted mt-1.5">
              In the currency you will spend in. We use it to rank people on a similar budget.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-text-primary mb-2 block">Room type</label>
            <div className="flex flex-wrap gap-2">
              {['shared', '1BHK', '2BHK', 'studio'].map(t => (
                <button key={t} onClick={() => update('flat_type', t)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data.flat_type === t ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    // Step 3: Lifestyle
    {
      title: "What's your lifestyle?",
      subtitle: 'Help us find compatible matches',
      content: (
        <div className="space-y-5 mt-6">
          {[
            { key: 'cleanliness', label: 'Cleanliness', options: [{v:1,l:'Relaxed'},{v:2,l:''},{v:3,l:'Moderate'},{v:4,l:''},{v:5,l:'Spotless'}], type: 'range' },
            { key: 'sleep_time', label: 'Sleep Schedule', options: [{v:'early',l:'Early Bird'},{v:'flexible',l:'Flexible'},{v:'late',l:'Night Owl'}], type: 'choice' },
            { key: 'social_level', label: 'Social Level', options: [{v:'introvert',l:'Introvert'},{v:'moderate',l:'Balanced'},{v:'extrovert',l:'Extrovert'}], type: 'choice' },
            { key: 'smoking', label: 'Smoking', options: [{v:'no',l:'No'},{v:'yes',l:'Yes'}], type: 'choice' },
            { key: 'drinking', label: 'Drinking', options: [{v:'no',l:'No'},{v:'yes',l:'Yes'}], type: 'choice' },
            { key: 'diet', label: 'Diet', options: [{v:'veg',l:'Vegetarian'},{v:'eggetarian',l:'Eggetarian'},{v:'nonveg',l:'Non-veg'},{v:'vegan',l:'Vegan'}], type: 'choice' },
          ].map(field => (
            <div key={field.key}>
              <label id={`ob-${field.key}`} className="text-sm font-semibold text-text-primary mb-2 block">{field.label}</label>
              {field.type === 'range' ? (
                <div>
                  <input type="range" aria-labelledby={`ob-${field.key}`} min={1} max={5} value={data[field.key]}
                    onChange={e => update(field.key, parseInt(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    {field.options.map(o => <span key={o.v}>{o.l}</span>)}
                  </div>
                </div>
              ) : (
                <div role="group" aria-labelledby={`ob-${field.key}`} className="flex flex-wrap gap-2">
                  {field.options.map(o => (
                    <button key={o.v} onClick={() => update(field.key, o.v)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data[field.key] === o.v ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    // Step 4: Interests
    {
      title: 'What are you into?',
      subtitle: 'Select at least 3 interests',
      content: (
        <div className="flex flex-wrap gap-3 mt-6">
          {INTERESTS.map(int => (
            <button key={int.id} onClick={() => toggleInterest(int.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${data.interests.includes(int.id) ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral'}`}>
              <span>{int.icon}</span>
              <span>{int.label}</span>
            </button>
          ))}
        </div>
      ),
    },
  ];

  // New step 0 blocks Continue until it is complete; interests still needs 3.
  // Gender and DOB are the two fields matching actually depends on, so neither
  // can be skipped past.
  const aboutStepDone = Boolean(data.gender) && Boolean(data.date_of_birth) && !dobInvalid;
  const stepBlocked = step === 0 ? !aboutStepDone : step === steps.length - 1 && data.interests.length < 3;

  const handleSubmit = async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      // Re-validate immediately before the request: the disable state can go
      // stale if the user edits the date and clicks fast.
      const check = validateDob(data.date_of_birth);
      if (!check.ok) { setSubmitError(check.error); return; }
      await apiFetch('/onboarding', { method: 'POST', body: data });
      navigate('/discover', { replace: true });
    } catch (err) {
      setSubmitError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-6 flex flex-col min-h-screen">
      {/* Progress: a plain "Step 2 of 5" line reads honestly. Segmented bars
          plus a counter is decoration pretending to be information. */}
      <div className="pt-7 pb-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-text-primary">
            Step {step + 1} of {steps.length}
          </p>
          <p className="text-sm text-text-muted">{steps[step].subtitle}</p>
        </div>
        <div
          className="h-1.5 bg-surface-border rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label="Onboarding progress"
        >
          <div
            className="h-full bg-brand-coral rounded-full transition-[width] duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content. Slide is meaningful here: it answers "did my click land?" */}
      <div className="flex-1 py-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">{steps[step].title}</h1>
            {steps[step].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation. Buttons name the action; no trailing arrow. */}
      <div className="pb-7 pt-2">
        <InlineError error={submitError} />
        <div className="flex gap-3 mt-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-surface-border text-text-secondary font-semibold hover:bg-surface-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <button
            type="button"
            onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : handleSubmit()}
            disabled={loading || stepBlocked}
            className="flex-1 px-5 py-3 rounded-xl bg-brand-coral hover:bg-brand-coral-dark text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
          >
            {loading
              ? 'Saving your answers'
              : step === steps.length - 1
                ? 'Finish and see matches'
                : 'Continue'}
          </button>
        </div>
        {step === 0 && !aboutStepDone && (
          <p className="text-sm text-text-muted mt-2 text-center">
            {!data.date_of_birth
              ? 'Add your date of birth so we can calculate your age.'
              : !data.gender
                ? 'Pick your gender to continue.'
                : dobCheck?.error}
          </p>
        )}
        {step === steps.length - 1 && data.interests.length < 3 && (
          <p className="text-sm text-text-muted mt-2 text-center">
            Pick {3 - data.interests.length} more so we can find people who share them.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
