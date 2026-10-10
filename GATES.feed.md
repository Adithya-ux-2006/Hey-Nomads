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
  EXPECT: all 43 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d41f6e7e0e229e36ac8d4f8230782d28cbcea13aa427dad7b9369a81cbe83f3a; exit=0; EXPECT=matched; output-sha256=44f693f2aeaeb222911fdae5f1ab313368be4a095e67414cc736ff8ec50dc0fe; output-bytes=4511; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] F2: Real recommendations exclude QA and walkthrough accounts
  CHECK: npm run verify:api
  EXPECT: all 43 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d41f6e7e0e229e36ac8d4f8230782d28cbcea13aa427dad7b9369a81cbe83f3a; exit=0; EXPECT=matched; output-sha256=dc8a43a6f87ec67d7eaea7574e092d0dce203613bd3800914c71a98277e58403; output-bytes=4511; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] F3: Account classification is centralised, not scattered substring
      matching, and the exclusion covers every automated-account family
  CHECK: npm run verify:api
  EXPECT: all 43 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d41f6e7e0e229e36ac8d4f8230782d28cbcea13aa427dad7b9369a81cbe83f3a; exit=0; EXPECT=matched; output-sha256=d8246988ddd3e049312327d9f2312ce8184bb4e00f7cfe8183ac3f985a023367; output-bytes=4511; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

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
  EXPECT: all 43 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d41f6e7e0e229e36ac8d4f8230782d28cbcea13aa427dad7b9369a81cbe83f3a; exit=0; EXPECT=matched; output-sha256=e8ca652dce7b36082e158dc152b6c893c22fbf4cb5b5ca544eba7cce23be01a2; output-bytes=4510; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I2: Demo chat issues no API write at all, so no real conversation, message
      or agreement can originate in Demo Mode
  CHECK: npm run qa:browser -- http://localhost:5199
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=bb7a18efa427dd3f8178ae552e8f3b001cbf5287d15aa8d5f5de3252228bb8a0; exit=0; EXPECT=matched; output-sha256=01f1898498b368297cf639ad9e24382913823f6573ca3bdaed69aac5cf460309; output-bytes=2209; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I3: Swiping or shortlisting a demo, QA or walkthrough account is refused
      server-side, so a hand-crafted request cannot bypass the UI
  CHECK: npm run verify:api
  EXPECT: all 43 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d41f6e7e0e229e36ac8d4f8230782d28cbcea13aa427dad7b9369a81cbe83f3a; exit=0; EXPECT=matched; output-sha256=b0062df9090866365da0bb762943223647b6022324680213adfe5acfc9b5537d; output-bytes=4510; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] I4: The classification is enforced from the stored address, not a
      client-supplied flag
  CHECK: npm run verify:api
  EXPECT: all 43 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d41f6e7e0e229e36ac8d4f8230782d28cbcea13aa427dad7b9369a81cbe83f3a; exit=0; EXPECT=matched; output-sha256=3151c7a7666257eed37450e361761534ecdc72cceabb6b44d018bdb4e3f451e5; output-bytes=4511; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

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