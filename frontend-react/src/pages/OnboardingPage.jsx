import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Home, Users, Music, Gamepad2, Dumbbell, Utensils, Plane, Laptop, Palette, BookOpen, Heart, ChevronRight, ChevronLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';

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

const CITIES = ['Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Hyderabad', 'Melbourne', 'London', 'Toronto', 'New York', 'Singapore'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
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
  const [loading, setLoading] = useState(false);

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
    // Step 0: What are you looking for?
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
              className={`p-5 rounded-2xl border-2 text-left transition-all ${data.looking_for === opt.value ? 'border-brand-coral bg-brand-coral/5 shadow-coral' : 'border-surface-border bg-white hover:border-brand-coral/30'}`}>
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
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-2 block">City</label>
            <div className="flex flex-wrap gap-2">
              {CITIES.map(city => (
                <button key={city} onClick={() => update('moving_to', city)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data.moving_to === city ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/30'}`}>
                  {city}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-2 block">Moving date</label>
            <input type="date" value={data.moving_date} onChange={e => update('moving_date', e.target.value)}
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
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-2 block">
              Monthly Budget: ₹{data.budget.toLocaleString()}
            </label>
            <input type="range" min={5000} max={100000} step={1000} value={data.budget}
              onChange={e => update('budget', parseInt(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-text-muted mt-1"><span>₹5K</span><span>₹1L</span></div>
          </div>
          <div>
            <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-2 block">Room type</label>
            <div className="flex flex-wrap gap-2">
              {['shared', '1BHK', '2BHK', 'studio'].map(t => (
                <button key={t} onClick={() => update('flat_type', t)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data.flat_type === t ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/30'}`}>
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
              <label className="text-xs font-bold tracking-wider text-text-muted uppercase mb-2 block">{field.label}</label>
              {field.type === 'range' ? (
                <div>
                  <input type="range" min={1} max={5} value={data[field.key]}
                    onChange={e => update(field.key, parseInt(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    {field.options.map(o => <span key={o.v}>{o.l}</span>)}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {field.options.map(o => (
                    <button key={o.v} onClick={() => update(field.key, o.v)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${data[field.key] === o.v ? 'bg-brand-coral text-white' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/30'}`}>
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${data.interests.includes(int.id) ? 'bg-brand-coral text-white shadow-coral' : 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/30'}`}>
              <span>{int.icon}</span>
              <span>{int.label}</span>
            </button>
          ))}
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiFetch('/onboarding', { method: 'POST', body: data });
      navigate('/discover', { replace: true });
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-8">
        <div className="flex items-center gap-2 mb-2">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-brand-coral' : 'bg-surface-border'}`} />
          ))}
        </div>
        <p className="text-xs text-text-muted font-medium">Step {step + 1} of {steps.length}</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h1 className="text-2xl font-display font-bold text-text-primary">{steps[step].title}</h1>
            <p className="text-text-secondary mt-1">{steps[step].subtitle}</p>
            {steps[step].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-surface-border text-text-secondary font-semibold hover:bg-surface-muted transition-all">
            <ChevronLeft size={18} /> Back
          </button>
        )}
        <button
          onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : handleSubmit()}
          disabled={loading || (step === 4 && data.interests.length < 3)}
          className="flex-1 flex items-center justify-center gap-2 bg-brand-coral hover:bg-brand-coral-dark text-white font-bold py-3.5 rounded-xl transition-all shadow-coral disabled:opacity-50">
          {loading ? 'Saving...' : step === steps.length - 1 ? 'Get Started' : 'Continue'}
          {step < steps.length - 1 && !loading && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
}
