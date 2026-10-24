// Demo Mode profiles.
//
// 10 synthetic roommate profiles with varied data. These feed the real matching
// engine (scoreCompatibility) so demo scores, breakdowns and reason chips are
// produced by the same code that scores real users. Profiles carry full
// lifestyle/preference fields so the scorer has real answers to work with.
//
// IDs 9101-9110 are outside real user ranges. @heynomads.app domain keeps them
// classified as DEMO by account-kind.mjs.
export const demoProfiles = [
  {
    id: 9101, name: 'Aarav Mehta', age: 26, city: 'Mumbai', occupation: 'Software Engineer',
    budget: 28000, bio: 'Loves weekend hikes and trying new cafes. Looking for a clean, quiet place to chill.',
    is_demo: true, interests: ['Music', 'Trekking', 'Cooking'], languages: ['English', 'Hindi'],
    cleanliness: 4, sleep_time: 'early', diet: 'veg', smoking: 'no', drinking: 'no',
    social_level: 'moderate', noise_tolerance: 'low', flat_type: 'shared', pets: 'no',
    work_schedule: '9-5', move_in_date: '2026-11-10', neighbourhood: 'Bandra', preferred_neighbourhood: 'Bandra',
    moving_to: 'Mumbai', country: 'India',
  },
  {
    id: 9102, name: 'Sara D\'Souza', age: 27, city: 'Mumbai', occupation: 'HR Manager',
    budget: 24000, bio: 'Looking for someone respectful of shared spaces and early routines.',
    is_demo: true, interests: ['Reading', 'Yoga', 'Coffee'], languages: ['English', 'Hindi', 'Marathi'],
    cleanliness: 5, sleep_time: 'early', diet: 'veg', smoking: 'no', drinking: 'occasional',
    social_level: 'introvert', noise_tolerance: 'low', flat_type: 'shared', pets: 'no',
    work_schedule: '9-5', move_in_date: '2026-11-12', neighbourhood: 'Andheri', preferred_neighbourhood: 'Andheri',
    moving_to: 'Mumbai', country: 'India',
  },
  {
    id: 9103, name: 'Priya Sharma', age: 24, city: 'Bangalore', occupation: 'UX Designer',
    budget: 21000, bio: 'Design enthusiast who values natural light and plants in the living room.',
    is_demo: true, interests: ['Music', 'Photography', 'Coffee'], languages: ['English', 'Hindi', 'Kannada'],
    cleanliness: 4, sleep_time: 'flexible', diet: 'veg', smoking: 'no', drinking: 'no',
    social_level: 'moderate', noise_tolerance: 'medium', flat_type: 'private', pets: 'okay',
    work_schedule: 'flexible', move_in_date: '2026-11-20', neighbourhood: 'Indiranagar', preferred_neighbourhood: 'Indiranagar',
    moving_to: 'Bangalore', country: 'India',
  },
  {
    id: 9104, name: 'Rohan Iyer', age: 25, city: 'Bangalore', occupation: 'Data Analyst',
    budget: 19000, bio: 'Keeps a tidy home and respects quiet hours after 10pm.',
    is_demo: true, interests: ['Gaming', 'Music', 'Cooking'], languages: ['English', 'Tamil'],
    cleanliness: 4, sleep_time: 'late', diet: 'non-veg', smoking: 'no', drinking: 'no',
    social_level: 'introvert', noise_tolerance: 'low', flat_type: 'shared', pets: 'no',
    work_schedule: '9-5', move_in_date: '2026-11-25', neighbourhood: 'Koramangala', preferred_neighbourhood: 'Koramangala',
    moving_to: 'Bangalore', country: 'India',
  },
  {
    id: 9105, name: 'Diya Patel', age: 28, city: 'Delhi', occupation: 'Product Manager',
    budget: 32000, bio: 'Travel often for work; looking for a flexible mate who enjoys city life.',
    is_demo: true, interests: ['Travel', 'Photography', 'Food'], languages: ['English', 'Hindi', 'Gujarati'],
    cleanliness: 3, sleep_time: 'flexible', diet: 'veg', smoking: 'no', drinking: 'occasional',
    social_level: 'extrovert', noise_tolerance: 'high', flat_type: 'private', pets: 'okay',
    work_schedule: 'flexible', move_in_date: '2026-11-05', neighbourhood: 'Hauz Khas', preferred_neighbourhood: 'Hauz Khas',
    moving_to: 'Delhi', country: 'India',
  },
  {
    id: 9106, name: 'Vikram Singh', age: 29, city: 'Delhi', occupation: 'Doctor',
    budget: 35000, bio: 'Long hours but values a clean, home-cooked meal at the end of the day.',
    is_demo: true, interests: ['Gaming', 'Music', 'Reading'], languages: ['English', 'Hindi', 'Punjabi'],
    cleanliness: 5, sleep_time: 'late', diet: 'non-veg', smoking: 'no', drinking: 'no',
    social_level: 'moderate', noise_tolerance: 'medium', flat_type: 'shared', pets: 'no',
    work_schedule: 'shifts', move_in_date: '2026-12-01', neighbourhood: 'Saket', preferred_neighbourhood: 'Saket',
    moving_to: 'Delhi', country: 'India',
  },
  {
    id: 9107, name: 'Ananya Rao', age: 23, city: 'Pune', occupation: 'Teacher',
    budget: 15000, bio: 'Enjoys reading, yoga, and helping others find their space.',
    is_demo: true, interests: ['Reading', 'Yoga', 'Coffee'], languages: ['English', 'Hindi', 'Marathi'],
    cleanliness: 4, sleep_time: 'early', diet: 'veg', smoking: 'no', drinking: 'no',
    social_level: 'introvert', noise_tolerance: 'low', flat_type: 'shared', pets: 'no',
    work_schedule: '9-5', move_in_date: '2026-11-15', neighbourhood: 'Kothrud', preferred_neighbourhood: 'Kothrud',
    moving_to: 'Pune', country: 'India',
  },
  {
    id: 9108, name: 'Kabir Joshi', age: 30, city: 'Pune', occupation: 'Chef',
    budget: 27000, bio: 'Passionate about food and keeping a well-organized kitchen.',
    is_demo: true, interests: ['Food', 'Music', 'Travel'], languages: ['English', 'Hindi', 'Marathi'],
    cleanliness: 4, sleep_time: 'late', diet: 'non-veg', smoking: 'no', drinking: 'occasional',
    social_level: 'extrovert', noise_tolerance: 'medium', flat_type: 'private', pets: 'okay',
    work_schedule: 'shifts', move_in_date: '2026-11-18', neighbourhood: 'Viman Nagar', preferred_neighbourhood: 'Viman Nagar',
    moving_to: 'Pune', country: 'India',
  },
  {
    id: 9109, name: 'Nandini Menon', age: 26, city: 'Hyderabad', occupation: 'Writer',
    budget: 22000, bio: 'Looking for a calm home and someone who appreciates quiet evenings.',
    is_demo: true, interests: ['Reading', 'Music', 'Coffee'], languages: ['English', 'Hindi', 'Telugu'],
    cleanliness: 4, sleep_time: 'early', diet: 'veg', smoking: 'no', drinking: 'no',
    social_level: 'introvert', noise_tolerance: 'low', flat_type: 'shared', pets: 'no',
    work_schedule: 'flexible', move_in_date: '2026-11-22', neighbourhood: 'Banjara Hills', preferred_neighbourhood: 'Banjara Hills',
    moving_to: 'Hyderabad', country: 'India',
  },
  {
    id: 9110, name: 'Arjun Patel', age: 27, city: 'Hyderabad', occupation: 'Engineer',
    budget: 26000, bio: 'Loves cricket, good conversation, and keeping things low-maintenance.',
    is_demo: true, interests: ['Cricket', 'Music', 'Food'], languages: ['English', 'Hindi', 'Telugu'],
    cleanliness: 3, sleep_time: 'flexible', diet: 'non-veg', smoking: 'no', drinking: 'occasional',
    social_level: 'extrovert', noise_tolerance: 'medium', flat_type: 'shared', pets: 'okay',
    work_schedule: '9-5', move_in_date: '2026-11-28', neighbourhood: 'Gachibowli', preferred_neighbourhood: 'Gachibowli',
    moving_to: 'Hyderabad', country: 'India',
  },
];
