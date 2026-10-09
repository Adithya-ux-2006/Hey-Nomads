import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch, auth, resolveMediaUrl } from '../lib/api'
import { Button, Spinner, ErrorState, InlineError } from '../components/UI'
import { ChevronLeft, Camera } from 'lucide-react'

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
]

const STEP_LABELS = ['Basic Info', 'Location', 'Lifestyle', 'Housing', 'Interests', 'Languages', 'Photo']

const inputCls = 'w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-brand-coral transition-all'
const labelCls = 'text-sm font-semibold text-text-primary mb-2 block'
const chipActive = 'bg-brand-coral text-white shadow-coral'
const chipBase = 'bg-white border border-surface-border text-text-secondary hover:border-brand-coral/30'
const chipCls = `px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer`

export default function EditProfilePage() {
  const navigate = useNavigate()
  const userId = auth.getUserId()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [languages, setLanguages] = useState([])
  const [imagePreview, setImagePreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const [form, setForm] = useState({
    name: '', age: '', gender: '', bio: '', occupation: '', university: '',
    city: '', movingTo: '', country: '', moveInDate: '', neighbourhood: '', preferredNeighbourhood: '',
    sleepTime: 'flexible', cleanliness: 3, diet: 'veg',
    noiseTolerance: 'moderate', noiseLevel: 3,
    smoking: 'no', drinking: 'no', partying: 'low',
    socialLevel: 'moderate', pets: '', workSchedule: '',
    budget: 15000, deposit: 5000, flatType: 'shared', occupants: 1,
    interests: [], languages: [],
    preferredGender: '', preferredBudgetMin: '', preferredBudgetMax: '',
    profileImage: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!userId) { navigate('/login'); return }
    const load = async () => {
      try {
        // No .catch() on the profile fetch. Swallowing it loaded the form with
        // hardcoded defaults (budget 15000, diet veg, deposit 5000) and then
        // POSTed those over the real profile on Save.
        const [dbLangs, profile] = await Promise.all([
          apiFetch('/languages').catch(() => []),
          apiFetch(`/profile/${userId}`),
        ])
        if (dbLangs?.length) setLanguages(dbLangs)
        if (profile) {
          setForm(f => ({
            ...f,
            name: profile.name || '',
            age: profile.age || '',
            gender: profile.gender || '',
            bio: profile.bio || '',
            occupation: profile.occupation || '',
            university: profile.university || '',
            city: profile.city || '',
            movingTo: profile.moving_to || profile.movingTo || '',
            country: profile.country || '',
            moveInDate: profile.move_in_date ? profile.move_in_date.split('T')[0] : (profile.moveInDate || ''),
            neighbourhood: profile.neighbourhood || '',
            preferredNeighbourhood: profile.preferred_neighbourhood || profile.preferredNeighbourhood || '',
            sleepTime: profile.sleep_time || profile.sleepTime || 'flexible',
            cleanliness: profile.cleanliness || 3,
            diet: profile.diet || 'veg',
            noiseTolerance: profile.noise_tolerance || profile.noiseTolerance || 'moderate',
            noiseLevel: profile.noise_level || profile.noiseLevel || 3,
            smoking: profile.smoking || 'no',
            drinking: profile.drinking || 'no',
            partying: profile.partying || 'low',
            socialLevel: profile.social_level || profile.socialLevel || 'moderate',
            pets: profile.pets || '',
            workSchedule: profile.work_schedule || profile.workSchedule || '',
            budget: profile.budget || 15000,
            deposit: profile.deposit || 5000,
            flatType: profile.flat_type || profile.flatType || 'shared',
            occupants: profile.occupants || 1,
            interests: profile.interests || [],
            languages: profile.languages?.map(l => l.id) || [],
            preferredGender: profile.preferred_gender || profile.preferredGender || '',
            preferredBudgetMin: profile.preferred_budget_min || profile.preferredBudgetMin || '',
            preferredBudgetMax: profile.preferred_budget_max || profile.preferredBudgetMax || '',
            profileImage: profile.profile_image || profile.profileImage || '',
          }))
          if (profile.profile_image || profile.profileImage) {
            const img = profile.profile_image || profile.profileImage
            setImagePreview(resolveMediaUrl(img))
          }
        }
      } catch (err) {
        setLoadError(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, navigate])

  const toggleInterest = (id) => {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(id) ? f.interests.filter(i => i !== id) : [...f.interests, id],
    }))
  }

  const toggleLang = (id) => {
    setForm(f => ({
      ...f,
      languages: f.languages.includes(id) ? f.languages.filter(l => l !== id) : [...f.languages, id],
    }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let imageUrl = form.profileImage
      if (selectedFile) {
        const uploadRes = await apiFetch('/upload', {
          method: 'POST',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type },
        })
        imageUrl = uploadRes.url
      }
      await apiFetch('/profile', {
        method: 'POST',
        body: {
          bio: form.bio,
          occupation: form.occupation,
          city: form.city,
          moveInDate: form.moveInDate || null,
          sleepTime: form.sleepTime,
          cleanliness: form.cleanliness,
          diet: form.diet,
          noiseTolerance: form.noiseTolerance,
          noiseLevel: form.noiseLevel,
          budget: form.budget,
          deposit: form.deposit,
          flatType: form.flatType,
          occupants: form.occupants,
          smoking: form.smoking,
          drinking: form.drinking,
          partying: form.partying,
          profileImage: imageUrl,
          languages: form.languages,
          preferredGender: form.preferredGender || null,
          preferredBudgetMin: form.preferredBudgetMin ? parseInt(form.preferredBudgetMin) : null,
          preferredBudgetMax: form.preferredBudgetMax ? parseInt(form.preferredBudgetMax) : null,
          socialLevel: form.socialLevel,
          pets: form.pets,
          workSchedule: form.workSchedule,
          neighbourhood: form.neighbourhood,
          preferredNeighbourhood: form.preferredNeighbourhood,
          gender: form.gender,
          age: form.age ? parseInt(form.age) : null,
          movingTo: form.movingTo,
          movingDate: form.moveInDate || null,
          university: form.university,
          country: form.country,
          interests: form.interests,
        },
      })
      navigate('/profile')
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-8 flex justify-center">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-16">
          <ErrorState what="profile" error={loadError} onRetry={() => window.location.reload()} />
        </div>
      </Layout>
    )
  }

  const progress = ((step + 1) / STEP_LABELS.length) * 100

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <InlineError error={saveError} />
        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div className="h-full bg-brand-coral rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-text-muted font-medium mt-2">Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}</p>
        </div>

        {/* Step content */}
        <div className="mt-6">

          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className={labelCls} htmlFor="f-name">Name</label>
                <input id="f-name" className={`${inputCls} bg-surface-muted cursor-not-allowed`} value={form.name} readOnly />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="f-age">Age</label>
                  <input id="f-age" type="number" className={inputCls} placeholder="25" value={form.age} onChange={e => set('age', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="f-gender">Gender</label>
                  <select id="f-gender" className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="f-bio">Bio</label>
                <textarea id="f-bio" rows={3} className={`${inputCls} resize-none`} placeholder="Tell potential roommates about yourself…" value={form.bio} onChange={e => set('bio', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-occupation">Occupation</label>
                <input id="f-occupation" className={inputCls} placeholder="e.g. UX Designer" value={form.occupation} onChange={e => set('occupation', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-university">University</label>
                <input id="f-university" className={inputCls} placeholder="e.g. University of Melbourne" value={form.university} onChange={e => set('university', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 1: Location */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelCls} htmlFor="f-city">City</label>
                <input id="f-city" className={inputCls} placeholder="e.g. Melbourne" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-movingTo">Moving To</label>
                <input id="f-movingTo" className={inputCls} placeholder="e.g. Melbourne" value={form.movingTo} onChange={e => set('movingTo', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-country">Country</label>
                <input id="f-country" className={inputCls} placeholder="e.g. Australia" value={form.country} onChange={e => set('country', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-moveInDate">Move-in Date</label>
                <input id="f-moveInDate" type="date" className={inputCls} value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-neighbourhood">Neighbourhood</label>
                <input id="f-neighbourhood" className={inputCls} placeholder="e.g. Fitzroy" value={form.neighbourhood} onChange={e => set('neighbourhood', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-preferredNeighbourhood">Preferred Neighbourhood</label>
                <input id="f-preferredNeighbourhood" className={inputCls} placeholder="e.g. CBD" value={form.preferredNeighbourhood} onChange={e => set('preferredNeighbourhood', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2: Lifestyle */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className={labelCls} id="g-sleep">Sleep Schedule</label>
                <div role="group" aria-labelledby="g-sleep" className="flex flex-wrap gap-2">
                  {[{ v: 'early', l: '🌅 Early Bird' }, { v: 'flexible', l: '⏰ Flexible' }, { v: 'late', l: '🌙 Night Owl' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('sleepTime', o.v)} className={`${chipCls} ${form.sleepTime === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-clean">Cleanliness: {form.cleanliness}/5</label>
                <div role="group" aria-labelledby="g-clean" className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => set('cleanliness', n)} className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${form.cleanliness >= n ? 'bg-brand-coral border-brand-coral text-white' : 'border-surface-border text-text-muted hover:border-brand-coral/30'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-diet">Diet</label>
                <div role="group" aria-labelledby="g-diet" className="flex flex-wrap gap-2">
                  {[{ v: 'veg', l: '🥗 Vegetarian' }, { v: 'eggetarian', l: '🥚 Eggetarian' }, { v: 'vegan', l: '🌱 Vegan' }, { v: 'nonveg', l: '🍗 Non-Veg' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('diet', o.v)} className={`${chipCls} ${form.diet === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-smoke">Smoking</label>
                <div role="group" aria-labelledby="g-smoke" className="flex gap-2">
                  {[{ v: 'no', l: '🚭 No' }, { v: 'yes', l: '🚬 Yes' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('smoking', o.v)} className={`${chipCls} flex-1 ${form.smoking === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-drink">Drinking</label>
                <div role="group" aria-labelledby="g-drink" className="flex gap-2">
                  {[{ v: 'no', l: '🧃 No' }, { v: 'yes', l: '🍺 Yes' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('drinking', o.v)} className={`${chipCls} flex-1 ${form.drinking === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-social">Social Level</label>
                <div role="group" aria-labelledby="g-social" className="flex gap-2">
                  {[{ v: 'introvert', l: 'Introvert' }, { v: 'moderate', l: 'Balanced' }, { v: 'extrovert', l: 'Extrovert' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('socialLevel', o.v)} className={`${chipCls} flex-1 ${form.socialLevel === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-noise">Noise Tolerance</label>
                <div role="group" aria-labelledby="g-noise" className="flex gap-2">
                  {[{ v: 'quiet', l: '🔇 Quiet' }, { v: 'moderate', l: '🔉 Moderate' }, { v: 'loud', l: '🔊 Loud OK' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('noiseTolerance', o.v)} className={`${chipCls} flex-1 ${form.noiseTolerance === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                {/* Free text here failed the pets CHECK constraint, which
                    500'd the entire profile save and discarded every other
                    field the user had filled in. */}
                <label className={labelCls} id="g-pets">Pets</label>
                <div role="group" aria-labelledby="g-pets" className="flex flex-wrap gap-2">
                  {[{ v: 'no', l: 'No pets' }, { v: 'okay', l: 'Okay with pets' }, { v: 'yes', l: 'Have pets' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('pets', o.v)} className={`${chipCls} ${form.pets === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} id="g-work">Work Schedule</label>
                <div role="group" aria-labelledby="g-work" className="flex flex-wrap gap-2">
                  {[{ v: 'regular', l: 'Regular hours' }, { v: 'flexible', l: 'Flexible' }, { v: 'remote', l: 'Remote' }, { v: 'night', l: 'Night shift' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set('workSchedule', o.v)} className={`${chipCls} ${form.workSchedule === o.v ? chipActive : chipBase}`}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Housing */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                {/* A free number, not a rupee-pinned slider. The old min=5000 max=100000
                    made a London budget of 1100 unselectable. */}
                <label className={labelCls} htmlFor="f-budget">Monthly budget: {form.budget || 0}</label>
                <input id="f-budget" type="number" min={0} className={inputCls}
                  value={form.budget} onChange={e => set('budget', parseInt(e.target.value) || 0)} />
                <p className="text-xs text-text-muted mt-1">
                  In the currency you will spend in. We use it to rank people on a similar budget.
                </p>
              </div>
              <div>
                <label className={labelCls} htmlFor="f-deposit">Deposit: {form.deposit || 0}</label>
                <input id="f-deposit" type="number" min={0} className={inputCls} value={form.deposit} onChange={e => set('deposit', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelCls} id="g-flat">Flat Type</label>
                <div role="group" aria-labelledby="g-flat" className="flex flex-wrap gap-2">
                  {['shared', '1BHK', '2BHK', '3BHK', 'studio', 'other'].map(t => (
                    <button key={t} type="button" onClick={() => set('flatType', t)} className={`${chipCls} ${form.flatType === t ? chipActive : chipBase}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="f-occupants">Occupants</label>
                <input id="f-occupants" type="number" min={1} max={10} className={inputCls} value={form.occupants} onChange={e => set('occupants', parseInt(e.target.value) || 1)} />
              </div>
              </div>
          )}

          {/* Step 4: Interests */}
          {step === 4 && (
            <div className="flex flex-wrap gap-3">
              {INTERESTS.map(int => (
                <button key={int.id} type="button" onClick={() => toggleInterest(int.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${form.interests.includes(int.id) ? chipActive : chipBase}`}>
                  <span>{int.icon}</span>
                  <span>{int.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 5: Languages */}
          {step === 5 && (
            <div className="flex flex-wrap gap-2">
              {languages.map(lang => (
                <button key={lang.id} type="button" onClick={() => toggleLang(lang.id)} className={`${chipCls} ${form.languages.includes(lang.id) ? chipActive : chipBase}`}>
                  {lang.name}
                </button>
              ))}
              {!languages.length && <p className="text-text-muted text-sm">No languages available.</p>}
            </div>
          )}

          {/* Step 6: Photo */}
          {step === 6 && (
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl border-2 border-surface-border overflow-hidden bg-surface-muted flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-coral">
                    {form.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className={`${chipCls} bg-brand-coral text-white cursor-pointer inline-flex items-center gap-2 px-4 py-2.5`}>
                  <Camera size={14} /> Upload Photo
                  <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                </label>
                {imagePreview && (
                  <button type="button" onClick={() => { setSelectedFile(null); setImagePreview(null); set('profileImage', '') }} className={`${chipCls} text-red-500 border-red-200 hover:bg-red-50 px-4 py-2.5`}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8 gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={18} /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => navigate('/profile')}>
              Cancel
            </Button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(s => s + 1)}>
              Save and continue
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner size="sm" /> Saving…</> : 'Save Profile'}
            </Button>
          )}
        </div>
      </div>
    </Layout>
  )
}
