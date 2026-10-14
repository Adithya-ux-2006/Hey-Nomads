// The four people the guided walkthrough is built from.
//
// Kept apart from the session code so the page and the QA suite provision the
// exact same cohort. They used to carry their own copies, and the two drifted:
// the suite registered everyone with a generic occupation and a "synthetic
// profile" bio, so a walkthrough that ran after QA showed three identical
// cards. One file, one set of people.
//
// Pure data - no fetch, no environment. Node imports this directly.

export const MOVE_DATE = '2026-11-15';

export const NS = 'qa.present.';
export const emailFor = role => `${NS}${role}@gmail.com`;

export const COHORT = [
  {
    role: 'host',
    name: 'Avery Lane', age: 27, gender: 'Woman',
    occupation: 'Product designer',
    bio: 'Moved to London two years ago and now looking for a second person for a two-bed in Hackney. I work from home three days a week, cook most evenings and keep odd hours on weekends.',
    interests: ['hiking', 'cooking', 'music', 'photography'],
    budget: 1450, flatType: '2BHK', cleanliness: 4, sleepTime: 'flexible',
    diet: 'eggetarian', smoking: 'no', drinking: 'no',
    noiseTolerance: 'moderate', noiseLevel: 3, pets: 'no', workSchedule: 'remote',
  },
  {
    role: 'ada',
    name: 'Ada Mensah', age: 25, gender: 'Woman',
    occupation: 'UX researcher',
    bio: 'Researcher at a health startup. Quiet during the week, out on the trails on Saturday. Looking for a calm flat with someone who tidies as they go.',
    interests: ['music', 'photography', 'hiking', 'reading'],
    budget: 1250, flatType: '2BHK', cleanliness: 4, sleepTime: 'flexible',
    diet: 'veg', smoking: 'no', drinking: 'no',
    noiseTolerance: 'moderate', noiseLevel: 3, pets: 'okay', workSchedule: 'remote',
  },
  {
    role: 'noor',
    name: 'Noor Haddad', age: 29, gender: 'Man',
    occupation: 'Nurse',
    bio: 'Shift nurse at UCLH, so I am out early and asleep by ten most nights. Happy to share a two-bed near the station with someone considerate about noise.',
    interests: ['cooking', 'hiking', 'running', 'music'],
    budget: 1400, flatType: '2BHK', cleanliness: 3, sleepTime: 'late',
    diet: 'nonveg', smoking: 'no', drinking: 'yes',
    noiseTolerance: 'moderate', noiseLevel: 3, pets: 'no', workSchedule: 'night',
  },
  {
    role: 'sam',
    name: 'Sam Okafor', age: 31, gender: 'Man',
    occupation: 'Data analyst',
    bio: 'Analyst by day, terrible at houseplants by night. I am after a bright second room in a flat where people actually talk before problems build up.',
    interests: ['cooking', 'photography', 'travel', 'music'],
    budget: 1550, flatType: '2BHK', cleanliness: 5, sleepTime: 'flexible',
    diet: 'veg', smoking: 'no', drinking: 'yes',
    noiseTolerance: 'moderate', noiseLevel: 3, pets: 'no', workSchedule: 'flexible',
  },
];

// The column is checked against lowercase values ('roommate' | 'community' |
// 'both'); a capitalised label fails the constraint.
export const onboardingBody = a => ({
  looking_for: 'roommate',
  moving_to: 'London',
  moving_date: MOVE_DATE,
  interests: a.interests,
  budget: a.budget,
  flat_type: a.flatType,
  cleanliness: a.cleanliness,
  sleep_time: a.sleepTime,
  social_level: 'moderate',
  smoking: a.smoking,
  drinking: a.drinking,
  diet: a.diet,
});

export const profileBody = a => ({
  bio: a.bio,
  occupation: a.occupation,
  city: 'London',
  moveInDate: MOVE_DATE,
  budget: a.budget,
  flatType: a.flatType,
  cleanliness: a.cleanliness,
  sleepTime: a.sleepTime,
  socialLevel: 'moderate',
  smoking: a.smoking,
  drinking: a.drinking,
  diet: a.diet,
  noiseTolerance: a.noiseTolerance,
  noiseLevel: a.noiseLevel,
  pets: a.pets,
  workSchedule: a.workSchedule,
  gender: a.gender,
  age: a.age,
  movingTo: 'London',
  movingDate: MOVE_DATE,
  interests: a.interests,
});
