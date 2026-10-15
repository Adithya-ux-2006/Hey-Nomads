// Demo Mode fixtures.
//
// These live in the client on purpose. The previous implementation fetched
// `GET /api/demo/profiles` with whatever token was in localStorage, so the page
// only opened for an already-authenticated visitor and its content came out of
// the real `users` table. The seeded rows it returned are fictional but written
// like ordinary people - "Aarav Mehta", Mumbai, a full bio - so a visitor could
// not tell a sample from a real account. The landing page also advertised
// "Try the demo account" and "Open the demo" as links to /login, so in practice
// the demo flow led straight into a live session.
//
// Demo Mode must be reachable without signing in, must never read the users
// table, and must never be able to inherit somebody else's session. Shipping
// the sample as static data gives all three with no server dependency.
export const demoProfiles = [
  {
    id: 9101,
    name: 'Sample Aarav Mehta',
    age: 26,
    city: 'Mumbai',
    occupation: 'Sample: Software Engineer',
    budget: 28000,
    bio: 'Sample profile for Demo Mode. Not a real person and not a real account.',
    is_demo: true,
  },
  {
    id: 9102,
    name: 'Sample Sara D’Souza',
    age: 27,
    city: 'Mumbai',
    occupation: 'Sample: HR Manager',
    budget: 24000,
    bio: 'Sample profile for Demo Mode. Not a real person and not a real account.',
    is_demo: true,
  },
  {
    id: 9103,
    name: 'Sample Priya Sharma',
    age: 24,
    city: 'Bangalore',
    occupation: 'Sample: UX Designer',
    budget: 21000,
    bio: 'Sample profile for Demo Mode. Not a real person and not a real account.',
    is_demo: true,
  },
  {
    id: 9104,
    name: 'Sample Rohan Iyer',
    age: 25,
    city: 'Bangalore',
    occupation: 'Sample: Data Analyst',
    budget: 19000,
    bio: 'Sample profile for Demo Mode. Not a real person and not a real account.',
    is_demo: true,
  },
];
