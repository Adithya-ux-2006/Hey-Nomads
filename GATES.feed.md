# Gates: feed integrity and profile rendering

Scope: A real person's feed contains only real people, automated accounts can
never reach it, Demo Mode demonstrates the flow without writing anything real,
and the profile page renders honestly at every supported width.

OWNS: frontend-react/api/account-kind.mjs, frontend-react/api/index.js,
  frontend-react/src/pages/ProfilePage.jsx,
  frontend-react/src/pages/RoommatesPage.jsx,
  frontend-react/scripts/verify-api-flows.mjs,
  frontend-react/scripts/profile-layout-qa.mjs

## Feed integrity

- [x] F1: Real recommendations exclude seeded demo profiles
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=e4e91c48955c9cb637026499db2cdc8ef4d78ecefaa3396da8c15705b96a7940; output-bytes=4838; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] F2: Real recommendations exclude QA and walkthrough accounts
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=bf5407685357791db2656e70233487d8ddcf4bed2fd73d7316d196f027ecf65d; output-bytes=4839; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] F3: Account classification is centralised, not scattered substring
      matching, and the exclusion covers every automated-account family
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=3d61919005d6b976209cee28e14077a6a3c963cfea72f0f6480ef757d54ca299; output-bytes=4839; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] F4: An empty real pool renders an intentional empty state that points at
      Demo Mode, rather than loosening the feed to fill it
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=0b844d5d312bf9e85276bb6360d8f5c0ff95684e5059a5fc336b0442b02c237a; output-bytes=2529; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] F5: Demo profiles are labelled wherever they appear
  CHECK: npm run qa:browser -- http://localhost:5199
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=bb7a18efa427dd3f8178ae552e8f3b001cbf5287d15aa8d5f5de3252228bb8a0; exit=0; EXPECT=matched; output-sha256=ead1833bba7889a5d959811810e5c188d7afa71f6cb3dd2d1063212a1cbd5cb4; output-bytes=2209; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

## Interaction isolation

- [x] I1: A demo like cannot create a real match
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=e334e834a31a0425eadaa07eb3763f6cb45665587a8b1cc186d6c2b42d47f7ae; output-bytes=4838; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I2: Demo chat issues no API write at all, so no real conversation, message
      or agreement can originate in Demo Mode
  CHECK: npm run qa:browser -- http://localhost:5199
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=bb7a18efa427dd3f8178ae552e8f3b001cbf5287d15aa8d5f5de3252228bb8a0; exit=0; EXPECT=matched; output-sha256=01f1898498b368297cf639ad9e24382913823f6573ca3bdaed69aac5cf460309; output-bytes=2209; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I3: Swiping or shortlisting a demo, QA or walkthrough account is refused
      server-side, so a hand-crafted request cannot bypass the UI
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=6394fc6d5dd082774809818347a0776e7ec446d7c78da7251d87c33813222a07; output-bytes=4839; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I4: The classification is enforced from the stored address, not a
      client-supplied flag
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=77878c09be64d94e7e28280625e88bb876af2e871a5eb14d6483211b19e9b72a; output-bytes=4840; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I5: The guards are bidirectional: a demo, QA or walkthrough account acting
      on its own is refused, not only one acting on a real target
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=e922e407fc15a838223b59756f327f091c9364b7d9eaded442c7967f6ecf7c4f; output-bytes=4840; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I6: An agreement requires two matched, genuine accounts, so a demo
      account cannot open one with a real user and read back their budget
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=063eda305d056780e5edcb694eb7a8c14d73a47595567dee1f428e6431d629e4; output-bytes=4840; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I7: Classification fails closed: a missing or malformed address is never
      treated as a real person
  CHECK: npm run verify:api
  EXPECT: all 46 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b7848a1cfbb1a9ddaa970b89ba452b5ad50483005649b7c37accfe2d39d7f682; exit=0; EXPECT=matched; output-sha256=d4ca75344c19dd560e236722531638d50070697ca764d478764ce0420c741363; output-bytes=4840; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

## Profile rendering

- [x] P1: 360, 390, 768 and 1440px all render with the avatar one padding unit
      from the card edge, the name aligned to it, and no horizontal overflow
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=27ef66059389a89823f591ff5b8863f071bdfc7b1da54021a2d0167ed6cbd783; output-bytes=2529; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] P2: The Edit button sits inside the card and is never clipped
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=050a0d39082481abfb84847a41f8234c9e0aa750636d7947aeb7b6f021f28c87; output-bytes=2529; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] P3: Missing profile information renders an intentional empty state, with
      a completion action for the owner and none for another user
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=cffc393cde5f5a27add0fe0c20b30258a2e1af2fa18284de07af6882c372568e; output-bytes=2529; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

<!--
All checks above are automated and were run against a local API and Vite dev
server backed by the real database, so they exercise the unmerged source rather
than the deployed build.

npm run qa:browser is intentionally NOT part of npm run verify: it registers
throwaway accounts and performs real swipes. It deletes the accounts it creates
on the way out. Run it against a local stack:
  node scripts/local-api.mjs
  npx vite --port 5199 --strictPort
  npm run qa:browser -- http://localhost:5199

No gate here is BLOCKED. F5 asserts the demo label inside Demo Mode only,
because demo profiles are excluded from every real surface by F1 and F2, so
they cannot appear elsewhere. Asserting a label on a surface that structurally
cannot contain the row would be theatre, not evidence.
-->