# Hey Nomads — Test Accounts

All accounts share the password: **`HeyNomads2026!`**

## Accounts

| # | Name | Email | City | Looking for | Verified as | Match & chat with |
|---|------|-------|------|-------------|-------------|-------------------|
| 1 | Aarav Mehta | `aarav.mehta@heynomads.app` | Mumbai | Roommate | Identity | Sara (87%) |
| 2 | Sara D'Souza | `sara.dsouza@heynomads.app` | Mumbai | Roommate | Email | Aarav (87%) |
| 3 | Priya Sharma | `priya.sharma@heynomads.app` | Bangalore | Both | University | Ananya (91%), Arjun (74%) |
| 4 | Ananya Iyer | `ananya.iyer@heynomads.app` | Delhi → Bangalore | Roommate | Email | Priya (91%) |
| 5 | Arjun Nair | `arjun.nair@heynomads.app` | Bangalore | Roommate | Identity | Priya (74%) |
| 6 | Rohan Verma | `rohan.verma@heynomads.app` | Pune → Melbourne | Both | University | Emily (80%) |
| 7 | Emily Watson | `emily.watson@heynomads.app` | Melbourne | Roommate | Identity | Rohan (80%) |
| 8 | James Carter | `james.carter@heynomads.app` | London | Roommate | Work | Maya (82%) |
| 9 | Maya Patel | `maya.patel@heynomads.app` | New York → London | Both | Email | James (82%) |
| 10 | Chloe Tremblay | `chloe.tremblay@heynomads.app` | Toronto | Both | University | Kabir (78%) |
| 11 | Kabir Singh | `kabir.singh@heynomads.app` | Delhi → Toronto | Roommate | Email | Chloe (78%) |
| 12 | Daniel Kim | `daniel.kim@heynomads.app` | Singapore | Roommate | Work | — (one-way likes only) |

## Seeded data

- **6 mutual matches** with **35 chat messages** across 6 conversations
- **8 one-way swipes** (likes/passes — these accounts still have people to discover)
- **8 communities** with 20 memberships (housing, professional, social, sports, outdoor, food)
- **8 upcoming events** with 11 RSVPs (all in the next ~3 weeks)
- **17 completed settlement tasks** for several users
- Full profiles: bios, budgets, neighbourhoods, languages, interests, preferences

## Re-running the seeder

```bash
cd frontend-react
node scripts/seed-test-data.mjs
```

It is **idempotent**: it deletes all `@heynomads.app` accounts (FK cascades remove
their swipes, matches, messages, communities and events) and reseeds fresh data.
It also auto-repairs the `messages` table if it is still on the legacy
`sender_id/receiver_id` shape.

## API smoke test

`scripts/smoke-test-api.mjs` exercises the real API handler end-to-end against
the live database (login → JWT → recommendations → matches → conversations →
send message → events → communities → settlement → discover). Current status:
**20 passed, 0 failed**.

```bash
cd frontend-react

# Terminal 1 — serve the real API handler (api/index.js) locally
node --import ./scripts/dns-shim.mjs scripts/local-api.mjs

# Terminal 2 — run the checks
node scripts/smoke-test-api.mjs
```

Notes:
- `dns-shim.mjs` is only needed where DNS is filtered for the database host;
  it resolves via DNS-over-HTTPS. Harmless to leave in the command elsewhere.
- `local-api.mjs` serves the exact handler Vercel runs, so the smoke test covers
  production behaviour. `vercel dev` also works, but its local proxy stalled in
  this environment.
- The smoke test deletes the message it sends, so the seeded threads stay pristine.
- Override credentials with `SMOKE_EMAIL` / `SMOKE_PASSWORD`, or the target with `BASE_URL`.
