import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Music, IndianRupee, Star, Heart, Settings, Camera, Calendar,
  Info, Briefcase, MapPin, Sun, ArrowLeft, Save, Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveMediaUrl, auth } from '../utils/api';
import Layout from '../components/Layout';

const fallbackLangs = [
  { id: 1, name: 'English' }, { id: 2, name: 'Hindi' }, { id: 3, name: 'Tamil' },
  { id: 4, name: 'Telugu' }, { id: 5, name: 'Kannada' }, { id: 6, name: 'Malayalam' },
  { id: 7, name: 'Marathi' }, { id: 8, name: 'Gujarati' }, { id: 9, name: 'Bengali' },
  { id: 10, name: 'Punjabi' }, { id: 11, name: 'Urdu' }, { id: 12, name: 'Spanish' },
  { id: 13, name: 'French' }, { id: 14, name: 'German' }, { id: 15, name: 'Other' }
];
import { staggerContainer, staggerItem } from '../utils/animations';

// ── Section wrapper ────────────────────────────────────────────
const Section = ({ icon: Icon, title, children, delay = 0 }) => (
  <motion.div
    variants={staggerItem}
    className="card p-6 space-y-5"
    whileHover={{ y: -2 }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-2 mb-1"
    >
      {Icon && <Icon size={17} className="text-brand-warm" />}
      <h2 className="font-display font-bold text-text-primary">{title}</h2>
    </motion.div>
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  </motion.div>
);

// ── Option Button ──────────────────────────────────────────────
const OptionBtn = ({ children, active, onClick, className = '' }) => (
  <motion.button
    type="button"
    onClick={onClick}
    variants={staggerItem}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${className} ${
      active
        ? 'bg-brand-primary border-brand-primary text-text-primary shadow-soft'
        : 'border-surface-border text-text-muted hover:border-brand-primary hover:text-text-secondary'
    }`}
  >
    {children}
  </motion.button>
);

// ── Cleanliness Picker ─────────────────────────────────────────
const CleanlinessSlider = ({ value, onChange }) => (
  <motion.div variants={staggerItem}>
    <label className="block text-xs font-semibold text-text-secondary mb-2">
      Cleanliness Level: <span className="text-brand-warm">{value}/5</span>
    </label>
    <motion.div className="flex gap-2" variants={staggerContainer} initial="hidden" animate="visible">
      {[1, 2, 3, 4, 5].map(n => (
        <motion.button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          variants={staggerItem}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
            value >= n
              ? 'bg-brand-primary border-brand-primary text-text-primary'
              : 'border-surface-border text-text-muted hover:border-brand-primary'
          }`}
        >
          {n === 1 ? '😅' : n === 2 ? '🙂' : n === 3 ? '😊' : n === 4 ? '✨' : '🌟'}
        </motion.button>
      ))}
    </motion.div>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="text-[11px] text-text-muted mt-1.5"
    >
      {value === 1 ? 'Very relaxed about cleanliness'
        : value === 2 ? 'Mostly tidy'
        : value === 3 ? 'Moderately clean'
        : value === 4 ? 'Quite clean'
        : 'Extremely clean'}
    </motion.p>
  </motion.div>
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
        console.log('Loading profile & languages from Supabase for editing');
        const { data: dbLangs, error: lError } = await supabase.from('languages').select('id, name');
        if (lError) console.error('Supabase languages query error:', lError);
        setAvailLangs(dbLangs && dbLangs.length > 0 ? dbLangs : fallbackLangs);

        const { data: profile, error: pError } = await supabase.rpc('get_profile', { p_user_id: userId });
        if (pError) {
          console.error('get_profile RPC error:', pError);
          throw new Error(pError.message || 'Failed to load profile details');
        }

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
  }, [userId, navigate]);

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
      let updatedImageUrl = form.profileImage;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        console.log('Uploading image to Supabase storage:', filePath);
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError);
          throw new Error(uploadError.message || 'Failed to upload image');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        updatedImageUrl = publicUrl;
      } else if (removeImg) {
        updatedImageUrl = null;
      }

      console.log('Upserting profile in Supabase profiles table');
      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: userId,
        bio: form.bio,
        occupation: form.occupation,
        city: form.city,
        move_in_date: form.moveInDate || null,
        budget: form.budget,
        deposit: form.deposit,
        flat_type: form.flatType,
        occupants: form.occupants,
        sleep_time: form.sleepTime,
        cleanliness: form.cleanliness,
        diet: form.diet,
        noise_tolerance: form.noiseTolerance,
        noise_level: form.noiseLevel,
        smoking: form.smoking,
        drinking: form.drinking,
        partying: form.partying,
        profile_image: updatedImageUrl,
      });

      if (profileError) {
        console.error('Supabase profiles update error:', profileError);
        throw new Error(profileError.message || 'Failed to update profile');
      }

      console.log('Upserting preferences in Supabase preferences table');
      const { error: prefError } = await supabase.from('preferences').upsert({
        user_id: userId,
        preferred_gender: form.preferredGender || null,
        preferred_budget_min: form.preferredBudgetMin ? parseInt(form.preferredBudgetMin) : null,
        preferred_budget_max: form.preferredBudgetMax ? parseInt(form.preferredBudgetMax) : null,
        preferred_location_radius: form.preferredLocationRadius,
        prefers_smoking: form.prefersSmoking,
        prefers_drinking: form.prefersDrinking,
        prefers_cleanliness_min: form.prefersCleanlinessMin,
        prefers_sleep_schedule: form.prefersSleepSchedule,
        prefers_same_diet: form.prefersSameDiet,
        prefers_same_sleep: form.prefersSameSleep,
      });

      if (prefError) {
        console.error('Supabase preferences update error:', prefError);
        throw new Error(prefError.message || 'Failed to update roommate preferences');
      }

      console.log('Updating user languages in Supabase');
      // Delete existing language links
      const { error: deleteLangsError } = await supabase
        .from('user_languages')
        .delete()
        .eq('user_id', userId);

      if (deleteLangsError) {
        console.error('Supabase delete user languages error:', deleteLangsError);
        throw new Error(deleteLangsError.message || 'Failed to clean old languages');
      }

      // Insert new language links if selected
      if (form.languages && form.languages.length > 0) {
        const langInserts = form.languages.map(langId => ({
          user_id: userId,
          language_id: langId
        }));
        const { error: insertLangsError } = await supabase
          .from('user_languages')
          .insert(langInserts);

        if (insertLangsError) {
          console.error('Supabase insert user languages error:', insertLangsError);
          throw new Error(insertLangsError.message || 'Failed to link languages');
        }
      }

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
      <motion.form
        onSubmit={handleSave}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto px-4 pt-6 pb-8"
      >
        {/* Header */}
        <motion.div variants={staggerItem} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => navigate('/profile')} className="btn-ghost p-2.5">
              <ArrowLeft size={18} />
            </motion.button>
            <motion.h1 variants={staggerItem} className="text-2xl font-display font-bold text-text-primary">Edit Profile</motion.h1>
          </div>
          <motion.button
            id="save-profile-btn"
            type="submit"
            disabled={saving}
            variants={staggerItem}
            whileTap={{ scale: 0.98 }}
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
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {saveMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`mb-4 p-3 rounded-xl text-sm text-center font-semibold ${saveMsg.startsWith('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}
            >
              {saveMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-5">
          {/* ── Photo Section ── */}
          <Section icon={Camera} title="Profile Photo">
            <motion.div className="flex items-center gap-5" variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={staggerItem} whileHover={{ scale: 1.03 }} className="w-20 h-20 rounded-2xl border-2 border-surface-border overflow-hidden bg-surface-muted flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-warm">
                    {auth.getUserName()?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </motion.div>
              <div className="flex flex-col gap-2">
                <motion.label variants={staggerItem} className="btn-primary cursor-pointer text-sm py-2 inline-flex items-center gap-2">
                  <Camera size={14} /> <span>Upload Photo</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </motion.label>
                <AnimatePresence>
                  {imagePreview && (
                    <motion.button
                      variants={staggerItem}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      type="button"
                      onClick={handleRemoveImg}
                      className="btn-ghost text-sm py-2 text-red-500 border-red-200 hover:bg-red-50"
                    >
                      Remove
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </Section>

          {/* ── About ── */}
          <Section icon={Info} title="About You">
            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Occupation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <motion.input id="edit-occupation" type="text" className="input pl-10" placeholder="e.g. UX Designer"
                    value={form.occupation} onChange={e => set('occupation', e.target.value)} />
                </div>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <motion.input id="edit-city" type="text" className="input pl-10" placeholder="e.g. Mumbai"
                    value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
              </motion.div>
            </motion.div>
            <motion.div variants={staggerItem}>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Bio</label>
              <motion.textarea
                id="edit-bio"
                className="input min-h-[96px] resize-none"
                placeholder="Tell potential roommates about yourself…"
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
              />
            </motion.div>
          </Section>

          {/* ── Rental Details ── */}
          <Section icon={IndianRupee} title="Rental Details">
            <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Monthly Rent (₹)</label>
                <motion.input id="edit-budget" type="number" className="input" placeholder="15000"
                  value={form.budget} onChange={e => set('budget', parseInt(e.target.value) || 0)} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Deposit (₹)</label>
                <motion.input id="edit-deposit" type="number" className="input" placeholder="30000"
                  value={form.deposit} onChange={e => set('deposit', parseInt(e.target.value) || 0)} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Flat Type</label>
                <motion.select id="edit-flat-type" className="input" value={form.flatType} onChange={e => set('flatType', e.target.value)}>
                  {['1BHK','2BHK','3BHK','shared','studio','other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </motion.select>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Occupants</label>
                <motion.input id="edit-occupants" type="number" min="1" max="10" className="input" placeholder="1"
                   value={form.occupants} onChange={e => set('occupants', parseInt(e.target.value) || 1)} />
              </motion.div>
              <motion.div variants={staggerItem} className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Move-in Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <motion.input id="edit-move-in-date" type="date" className="input pl-10"
                    value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)} />
                </div>
              </motion.div>
            </motion.div>
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
            <motion.div className="flex flex-wrap gap-2" variants={staggerContainer} initial="hidden" animate="visible">
              {availLangs.map(lang => (
                <motion.button
                  key={lang.id}
                  type="button"
                  variants={staggerItem}
                  onClick={() => toggleLang(lang.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.languages.includes(lang.id)
                      ? 'bg-brand-accent/20 border-brand-accent text-green-700'
                      : 'border-surface-border text-text-muted hover:border-brand-primary'
                  }`}
                >
                  {lang.name}
                </motion.button>
              ))}
            </motion.div>
          </Section>

          {/* ── Preferences ── */}
          <Section icon={Settings} title="Roommate Preferences">
            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Preferred Gender</label>
                <motion.select className="input" value={form.preferredGender} onChange={e => set('preferredGender', e.target.value)}>
                  <option value="">No preference</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="any">Any</option>
                </motion.select>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Preferred Sleep Schedule</label>
                <motion.select className="input" value={form.prefersSleepSchedule} onChange={e => set('prefersSleepSchedule', e.target.value)}>
                  <option value="no_preference">No preference</option>
                  <option value="early">Early bird</option>
                  <option value="late">Night owl</option>
                  <option value="flexible">Flexible</option>
                </motion.select>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Roommate Smoking</label>
                <motion.select className="input" value={form.prefersSmoking} onChange={e => set('prefersSmoking', e.target.value)}>
                  <option value="no_preference">No preference</option>
                  <option value="no">Non-smoker only</option>
                  <option value="yes">Smoker OK</option>
                </motion.select>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Roommate Drinking</label>
                <motion.select className="input" value={form.prefersDrinking} onChange={e => set('prefersDrinking', e.target.value)}>
                  <option value="no_preference">No preference</option>
                  <option value="no">Non-drinker only</option>
                  <option value="yes">Drinker OK</option>
                </motion.select>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Budget Range (₹)</label>
                <div className="flex gap-2">
                  <motion.input type="number" className="input" placeholder="Min"
                    value={form.preferredBudgetMin} onChange={e => set('preferredBudgetMin', e.target.value)} />
                  <motion.input type="number" className="input" placeholder="Max"
                    value={form.preferredBudgetMax} onChange={e => set('preferredBudgetMax', e.target.value)} />
                </div>
              </motion.div>
              <motion.div variants={staggerItem}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Min Cleanliness Required: {form.prefersCleanlinessMin}/5
                </label>
                <motion.input type="range" min="1" max="5" step="1"
                  value={form.prefersCleanlinessMin} onChange={e => set('prefersCleanlinessMin', parseInt(e.target.value))} />
              </motion.div>
            </motion.div>

            <motion.div className="flex flex-wrap gap-3 pt-2" variants={staggerContainer} initial="hidden" animate="visible">
              {[
                { key: 'prefersSameDiet', label: '🥗 Prefers same diet' },
                { key: 'prefersSameSleep', label: '🌙 Prefers same sleep schedule' },
              ].map(({ key, label }) => (
                <motion.button
                  key={key}
                  type="button"
                  variants={staggerItem}
                  onClick={() => set(key, !form[key])}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    form[key]
                      ? 'bg-brand-primary border-brand-primary text-text-primary'
                      : 'border-surface-border text-text-muted hover:border-brand-primary'
                  }`}
                >
                  {label} {form[key] ? '✓' : ''}
                </motion.button>
              ))}
            </motion.div>
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
      </motion.form>
    </Layout>
  );
};

export default EditProfilePage;
