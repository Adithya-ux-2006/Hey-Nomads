import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Music, IndianRupee, Star, Heart, Settings, Camera, Calendar,
  Info, Briefcase, MapPin, Sun, ArrowLeft, Save
} from 'lucide-react';
import { apiFetch, auth, API_BASE_URL, resolveMediaUrl } from '../utils/api';
import Layout from '../components/Layout';

// ── Section wrapper ────────────────────────────────────────────
const Section = ({ icon: Icon, title, children }) => (
  <div className="card p-6 space-y-5">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={17} className="text-brand-warm" />}
      <h2 className="font-display font-bold text-text-primary">{title}</h2>
    </div>
    {children}
  </div>
);

// ── Option Button ──────────────────────────────────────────────
const OptionBtn = ({ children, active, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${className} ${
      active
        ? 'bg-brand-primary border-brand-primary text-text-primary shadow-soft'
        : 'border-surface-border text-text-muted hover:border-brand-primary hover:text-text-secondary'
    }`}
  >
    {children}
  </button>
);

// ── Cleanliness Picker ─────────────────────────────────────────
const CleanlinessSlider = ({ value, onChange }) => (
  <div>
    <label className="block text-xs font-semibold text-text-secondary mb-2">
      Cleanliness Level: <span className="text-brand-warm">{value}/5</span>
    </label>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
            value >= n
              ? 'bg-brand-primary border-brand-primary text-text-primary'
              : 'border-surface-border text-text-muted hover:border-brand-primary'
          }`}
        >
          {n === 1 ? '😅' : n === 2 ? '🙂' : n === 3 ? '😊' : n === 4 ? '✨' : '🌟'}
        </button>
      ))}
    </div>
    <p className="text-[11px] text-text-muted mt-1.5">
      {value === 1 ? 'Very relaxed about cleanliness'
        : value === 2 ? 'Mostly tidy'
        : value === 3 ? 'Moderately clean'
        : value === 4 ? 'Quite clean'
        : 'Extremely clean'}
    </p>
  </div>
);

// ── Edit Profile Page ──────────────────────────────────────────
const EditProfilePage = () => {
  const navigate  = useNavigate();
  const userId    = auth.getUserId();
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [availLangs, setAvailLangs] = useState([]);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [imagePreview, setImagePreview]   = useState(null);
  const [removeImg, setRemoveImg]         = useState(false);

  const [form, setForm] = useState({
    // core
    bio: '', occupation: '', city: '', moveInDate: '',
    // financial
    budget: 15000, deposit: 5000, flatType: 'shared', occupants: 1,
    // lifestyle
    sleepTime: 'flexible', cleanliness: 3, diet: 'veg',
    noiseTolerance: 'moderate', noiseLevel: 3,
    smoking: 'no', drinking: 'no', partying: 'low',
    // languages
    languages: [],
    // image
    profileImage: '',
    // preferences
    preferredGender: '', preferredBudgetMin: '', preferredBudgetMax: '',
    preferredLocationRadius: 10, prefersSmoking: 'no_preference',
    prefersDrinking: 'no_preference', prefersCleanlinessMin: 1,
    prefersSleepSchedule: 'no_preference',
    prefersSameDiet: false, prefersSameSleep: false,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    const load = async () => {
      try {
        const [langs, profile] = await Promise.all([
          apiFetch('/languages'),
          apiFetch(`/profile/${userId}`)
        ]);
        setAvailLangs(langs || []);
        if (profile) {
          setForm(f => ({
            ...f,
            bio:          profile.bio || '',
            occupation:   profile.occupation || '',
            city:         profile.city || '',
            moveInDate:   profile.move_in_date ? profile.move_in_date.split('T')[0] : '',
            budget:       profile.budget || 15000,
            deposit:      profile.deposit || 5000,
            flatType:     profile.flat_type || 'shared',
            occupants:    profile.occupants || 1,
            sleepTime:    profile.sleep_time || 'flexible',
            cleanliness:  profile.cleanliness || 3,
            diet:         profile.diet || 'veg',
            noiseTolerance: profile.noise_tolerance || 'moderate',
            noiseLevel:   profile.noise_level || 3,
            smoking:      profile.smoking || 'no',
            drinking:     profile.drinking || 'no',
            partying:     profile.partying || 'low',
            profileImage: profile.profile_image || '',
            languages:    profile.languages?.map(l => l.id) || [],
            // preferences
            preferredGender:         profile.preferred_gender || '',
            preferredBudgetMin:      profile.preferred_budget_min || '',
            preferredBudgetMax:      profile.preferred_budget_max || '',
            preferredLocationRadius: profile.preferred_location_radius || 10,
            prefersSmoking:          profile.prefers_smoking || 'no_preference',
            prefersDrinking:         profile.prefers_drinking || 'no_preference',
            prefersCleanlinessMin:   profile.prefers_cleanliness_min || 1,
            prefersSleepSchedule:    profile.prefers_sleep_schedule || 'no_preference',
            prefersSameDiet:         !!profile.prefers_same_diet,
            prefersSameSleep:        !!profile.prefers_same_sleep,
          }));
          if (profile.profile_image) setImagePreview(resolveMediaUrl(profile.profile_image));
        }
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImg(false);
  };

  const handleRemoveImg = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setRemoveImg(true);
    set('profileImage', '');
  };

  const toggleLang = id => {
    setForm(f => ({
      ...f,
      languages: f.languages.includes(id)
        ? f.languages.filter(x => x !== id)
        : [...f.languages, id]
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const fd = new FormData();
      fd.append('userId', userId);
      // Core
      fd.append('bio', form.bio);
      fd.append('occupation', form.occupation);
      fd.append('city', form.city);
      fd.append('moveInDate', form.moveInDate);
      // Financial
      fd.append('budget', form.budget);
      fd.append('deposit', form.deposit);
      fd.append('flatType', form.flatType);
      fd.append('occupants', form.occupants);
      // Lifestyle
      fd.append('sleepTime', form.sleepTime);
      fd.append('cleanliness', form.cleanliness);
      fd.append('diet', form.diet);
      fd.append('noiseTolerance', form.noiseTolerance);
      fd.append('noiseLevel', form.noiseLevel);
      fd.append('smoking', form.smoking);
      fd.append('drinking', form.drinking);
      fd.append('partying', form.partying);
      fd.append('taxBracket', 'medium');
      // Languages
      fd.append('languages', JSON.stringify(form.languages));
      // Preferences
      fd.append('preferredGender', form.preferredGender);
      fd.append('preferredBudgetMin', form.preferredBudgetMin);
      fd.append('preferredBudgetMax', form.preferredBudgetMax);
      fd.append('preferredLocationRadius', form.preferredLocationRadius);
      fd.append('prefersSmoking', form.prefersSmoking);
      fd.append('prefersDrinking', form.prefersDrinking);
      fd.append('prefersCleanlinessMin', form.prefersCleanlinessMin);
      fd.append('prefersSleepSchedule', form.prefersSleepSchedule);
      fd.append('prefersSameDiet', form.prefersSameDiet);
      fd.append('prefersSameSleep', form.prefersSameSleep);
      // Image
      if (selectedFile) fd.append('profile_image', selectedFile);
      else if (removeImg) fd.append('removeImage', 'true');

      const resp = await fetch(`${API_BASE_URL}/profile`, { method: 'POST', body: fd });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Save failed');
      setSaveMsg('Profile saved!');
      setTimeout(() => navigate('/profile'), 800);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Layout activePage="profile">
      <div className="max-w-3xl mx-auto px-4 pt-8 animate-pulse space-y-5">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
      </div>
    </Layout>
  );

  return (
    <Layout activePage="profile">
      <form onSubmit={handleSave} className="max-w-3xl mx-auto px-4 pt-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/profile')} className="btn-ghost p-2.5">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-2xl font-display font-bold text-text-primary">Edit Profile</h1>
          </div>
          <button
            id="save-profile-btn"
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </div>

        {saveMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm text-center font-semibold ${saveMsg.startsWith('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {saveMsg}
          </div>
        )}

        <div className="space-y-5">
          {/* ── Photo Section ── */}
          <Section icon={Camera} title="Profile Photo">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl border-2 border-surface-border overflow-hidden bg-surface-muted flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-warm">
                    {auth.getUserName()?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-primary cursor-pointer text-sm py-2">
                  <Camera size={14} /> Upload Photo
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
                {imagePreview && (
                  <button type="button" onClick={handleRemoveImg} className="btn-ghost text-sm py-2 text-red-500 border-red-200 hover:bg-red-50">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* ── About ── */}
          <Section icon={Info} title="About You">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Occupation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input id="edit-occupation" type="text" className="input pl-10" placeholder="e.g. UX Designer"
                    value={form.occupation} onChange={e => set('occupation', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input id="edit-city" type="text" className="input pl-10" placeholder="e.g. Mumbai"
                    value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Bio</label>
              <textarea
                id="edit-bio"
                className="input min-h-[96px] resize-none"
                placeholder="Tell potential roommates about yourself…"
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
              />
            </div>
          </Section>

          {/* ── Rental Details ── */}
          <Section icon={IndianRupee} title="Rental Details">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Monthly Rent (₹)</label>
                <input id="edit-budget" type="number" className="input" placeholder="15000"
                  value={form.budget} onChange={e => set('budget', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Deposit (₹)</label>
                <input id="edit-deposit" type="number" className="input" placeholder="30000"
                  value={form.deposit} onChange={e => set('deposit', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Flat Type</label>
                <select id="edit-flat-type" className="input" value={form.flatType} onChange={e => set('flatType', e.target.value)}>
                  {['1BHK','2BHK','3BHK','shared','studio','other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Occupants</label>
                <input id="edit-occupants" type="number" min="1" max="10" className="input" placeholder="1"
                   value={form.occupants} onChange={e => set('occupants', parseInt(e.target.value) || 1)} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Move-in Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input id="edit-move-in-date" type="date" className="input pl-10"
                    value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)} />
                </div>
              </div>
            </div>
          </Section>

          {/* ── Lifestyle ── */}
          <Section icon={Sun} title="Lifestyle Traits">
            <CleanlinessSlider value={form.cleanliness} onChange={v => set('cleanliness', v)} />

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">Sleep Schedule</label>
              <div className="flex gap-2">
                {[
                  { v: 'early', label: '🌅 Early Bird' },
                  { v: 'flexible', label: '⏰ Flexible' },
                  { v: 'late', label: '🌙 Night Owl' },
                ].map(({ v, label }) => (
                  <OptionBtn key={v} active={form.sleepTime === v} onClick={() => set('sleepTime', v)} className="flex-1">
                    {label}
                  </OptionBtn>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">Diet</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'veg', label: '🥗 Vegetarian' },
                  { v: 'eggetarian', label: '🥚 Eggetarian' },
                  { v: 'vegan', label: '🌱 Vegan' },
                  { v: 'nonveg', label: '🍗 Non-Veg' },
                ].map(({ v, label }) => (
                  <OptionBtn key={v} active={form.diet === v} onClick={() => set('diet', v)}>
                    {label}
                  </OptionBtn>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">Noise Tolerance</label>
              <div className="flex gap-2">
                {[
                  { v: 'quiet', label: '🔇 Quiet' },
                  { v: 'moderate', label: '🔉 Moderate' },
                  { v: 'loud', label: '🔊 Loud OK' },
                ].map(({ v, label }) => (
                  <OptionBtn key={v} active={form.noiseTolerance === v} onClick={() => set('noiseTolerance', v)} className="flex-1">
                    {label}
                  </OptionBtn>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Smoking</label>
                <div className="flex gap-2">
                  {[{ v: 'no', label: '🚭 No' }, { v: 'yes', label: '🚬 Yes' }].map(({ v, label }) => (
                    <OptionBtn key={v} active={form.smoking === v} onClick={() => set('smoking', v)} className="flex-1">{label}</OptionBtn>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Drinking</label>
                <div className="flex gap-2">
                  {[{ v: 'no', label: '🧃 No' }, { v: 'yes', label: '🍺 Yes' }].map(({ v, label }) => (
                    <OptionBtn key={v} active={form.drinking === v} onClick={() => set('drinking', v)} className="flex-1">{label}</OptionBtn>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Partying</label>
                <div className="flex gap-2">
                  {[{ v: 'low', label: '🏠 Low' }, { v: 'medium', label: '🎶 Med' }, { v: 'high', label: '🎉 High' }].map(({ v, label }) => (
                    <OptionBtn key={v} active={form.partying === v} onClick={() => set('partying', v)} className="flex-1 text-[11px]">{label}</OptionBtn>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Languages ── */}
          <Section icon={Heart} title="Languages">
            <div className="flex flex-wrap gap-2">
              {availLangs.map(lang => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => toggleLang(lang.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.languages.includes(lang.id)
                      ? 'bg-brand-accent/20 border-brand-accent text-green-700'
                      : 'border-surface-border text-text-muted hover:border-brand-primary'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Preferences ── */}
          <Section icon={Settings} title="Roommate Preferences">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Preferred Gender</label>
                <select className="input" value={form.preferredGender} onChange={e => set('preferredGender', e.target.value)}>
                  <option value="">No preference</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="any">Any</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Preferred Sleep Schedule</label>
                <select className="input" value={form.prefersSleepSchedule} onChange={e => set('prefersSleepSchedule', e.target.value)}>
                  <option value="no_preference">No preference</option>
                  <option value="early">Early bird</option>
                  <option value="late">Night owl</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Roommate Smoking</label>
                <select className="input" value={form.prefersSmoking} onChange={e => set('prefersSmoking', e.target.value)}>
                  <option value="no_preference">No preference</option>
                  <option value="no">Non-smoker only</option>
                  <option value="yes">Smoker OK</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Roommate Drinking</label>
                <select className="input" value={form.prefersDrinking} onChange={e => set('prefersDrinking', e.target.value)}>
                  <option value="no_preference">No preference</option>
                  <option value="no">Non-drinker only</option>
                  <option value="yes">Drinker OK</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Budget Range (₹)</label>
                <div className="flex gap-2">
                  <input type="number" className="input" placeholder="Min"
                    value={form.preferredBudgetMin} onChange={e => set('preferredBudgetMin', e.target.value)} />
                  <input type="number" className="input" placeholder="Max"
                    value={form.preferredBudgetMax} onChange={e => set('preferredBudgetMax', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Min Cleanliness Required: {form.prefersCleanlinessMin}/5
                </label>
                <input type="range" min="1" max="5" step="1"
                  value={form.prefersCleanlinessMin} onChange={e => set('prefersCleanlinessMin', parseInt(e.target.value))} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {[
                { key: 'prefersSameDiet', label: '🥗 Prefers same diet' },
                { key: 'prefersSameSleep', label: '🌙 Prefers same sleep schedule' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set(key, !form[key])}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    form[key]
                      ? 'bg-brand-primary border-brand-primary text-text-primary'
                      : 'border-surface-border text-text-muted hover:border-brand-primary'
                  }`}
                >
                  {label} {form[key] ? '✓' : ''}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Bottom Save */}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={() => navigate('/profile')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" id="save-profile-bottom" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : <><Save size={15} /> Save Profile</>}
          </button>
        </div>
      </form>
    </Layout>
  );
};

export default EditProfilePage;
