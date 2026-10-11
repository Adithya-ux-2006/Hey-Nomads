- [x] F1: Real recommendations exclude seeded demo profiles
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=aebabb8773d01b1706c330b434fbe503f3cce7cb93622b568c4f36f3aee6806e; output-bytes=5570; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] F2: Real recommendations exclude QA and walkthrough accounts
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=2f5eca036492ec2eadd040c1f2419c19fde94e73d95b08962bb1a21ec98b2531; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] F3: Account classification is centralised, not scattered substring
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=f5322c3d8826311cc92de62443166b07fafc44340b52e0b0afeb50db6b6580da; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      matching, and the exclusion covers every automated-account family
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] F4: An empty real pool renders an intentional empty state that points at
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=f1b00eb02c0b7ad14ff6c2b4cf8022b3760136541a853f9ddf0084c39c3a2cc8; output-bytes=2531; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      Demo Mode, rather than loosening the feed to fill it
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
- [x] F5: Demo profiles are labelled wherever they appear
  CHECK: npm run qa:browser -- http://localhost:5199
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=bb7a18efa427dd3f8178ae552e8f3b001cbf5287d15aa8d5f5de3252228bb8a0; exit=0; EXPECT=matched; output-sha256=9a04cb62b62f9307c6fd1f1c8bcb9e761bd59c77a60a19d37759a20506adbdfc; output-bytes=2205; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] I1: A demo like cannot create a real match
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=9a76c4f25be7b429ef96bce519f7dec2424792df04b5e3282f264b03150b3c27; output-bytes=5568; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] I2: Demo chat issues no API write at all, so no real conversation, message
  EVIDENCE: automatic-evidence=v1; definition-sha256=bb7a18efa427dd3f8178ae552e8f3b001cbf5287d15aa8d5f5de3252228bb8a0; exit=0; EXPECT=matched; output-sha256=99c9d1684bfeac0d975b35fd17a1e67a1dec5018c3cc2e75150aabb946f1e6f3; output-bytes=2205; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      or agreement can originate in Demo Mode
  CHECK: npm run qa:browser -- http://localhost:5199
  EXPECT: browser qa passed
  CWD: frontend-react
- [x] I3: Swiping or shortlisting a demo, QA or walkthrough account is refused
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=45635f3c7d2d023ff9539476f9320dc94c3833c4fb3e928e57588eb5b978e43e; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      server-side, so a hand-crafted request cannot bypass the UI
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] I4: The classification is enforced from the stored address, not a
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=2aeb03a39abeee7f82efad017b80afe5e4586525fa2aca8db1d9f6f8425b9fb7; output-bytes=5565; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      client-supplied flag
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] I5: The guards are bidirectional: a demo, QA or walkthrough account acting
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=adde65abd9b7765c57f6ed70805029022523120db9ba9c7f75ba371e0f372540; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      on its own is refused, not only one acting on a real target
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] I6: An agreement requires two matched, genuine accounts, so a demo
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=caeb37d16fd20ee5e384c2e709ae9bd57d091d23d274fc72f1cfa7e4f32ae2a4; output-bytes=5565; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      account cannot open one with a real user and read back their budget
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] I7: Classification fails closed: a missing or malformed address is never
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=a77218c3ba2e2cb5d08081186e5ed7e45a004d05f0e8503ff7b9a55493603d99; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      treated as a real person
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] P1: 360, 390, 768 and 1440px all render with the avatar one padding unit
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=293f0aa7217441bf9a84702b344f8196c5ae2f376e771c86a1c78cd1a043055e; output-bytes=2531; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      from the card edge, the name aligned to it, and no horizontal overflow
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
- [x] P2: The Edit button sits inside the card and is never clipped
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=24840a107c42ace87caa43476d43e69d4edb1f580abee27f1b18e854fa54ea07; output-bytes=2531; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] P3: Missing profile information renders an intentional empty state, with
  EVIDENCE: automatic-evidence=v1; definition-sha256=9ae8327bb383ec8b62e43225ee79cdef0aa33c7d20d933c49c906b0723c96817; exit=0; EXPECT=matched; output-sha256=a2e270706518284b8ce0e1bcded8c1f6d00a2890ee79d6ab944df473b399cf60; output-bytes=2531; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      a completion action for the owner and none for another user
  CHECK: npm run qa:profile -- http://localhost:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
- [x] D1: A real user cannot read a demo, QA or walkthrough profile by guessing
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=8e63ae17af2a2baf29e9c4c625b995566a608901b16717b9b9e2aa697f011bda; output-bytes=5569; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      the id, and the refusal is 404 rather than 403 so existence is not
      confirmed
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] D2: Legitimate profile navigation is unaffected: own profile, a real peer,
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=1f5c112957c209144d93b2d26cc75dd6ca12c2a43255fbc9c2fd164fe6664c9e; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      and the `is_self` flag all still resolve
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] D3: An unknown or malformed classification is never served as a real
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=4a39bbe62d6c0c7f72c9e64b96e13839efd11e2cfe024e6d720b7ec80663a986; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      profile
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] D4: A non-real actor cannot read a real profile by id. The feed filter is
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=21db76cbea7a5622d299882f9e43b5e401fb2863f5c23a4d65aa0c1fb5995a5d; output-bytes=5564; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      only half the defence; without an actor check a demo session can still ask
      for any real id. Self remains readable.
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] A1: Creating a new agreement requires two matched, genuine accounts
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=70406f6e4f1bfe88be9d9a98c67440462485dff398de82842f8aa6436865349a; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] A2: An existing agreement stays readable and editable by its parties
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=09f22c570715f6aaa837399589acd3163d18f2df974bb904827c3ae1588ff56c; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      after they unmatch
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] A3: Demo-to-real agreement creation and reading remain refused
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=9fa133e1fc794b8c4d7b323085c8690509f14f11fa7753a288dd5e5cdb06f56e; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
- [x] A4: Both parties must be genuine to read or edit ANY agreement. The
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=89a35ec8e3bbcee9847a06ab2d432dd33060f4d7019afaff792a3f2fb26e6b1e; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      existing-document path must not skip the account check, or a historical
      demo/real agreement could be rewritten by the demo side. Only the
      matched-pair requirement is specific to new documents.
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
- [x] A5: The agreements list never returns a document to a non-real party,
  EVIDENCE: automatic-evidence=v1; definition-sha256=b63b8df47df3545b081189e4eb6d1fb7d91c99c60e84cbb24c1873fabfb9a24f; exit=0; EXPECT=matched; output-sha256=c2f72c1b669072121b641b10d3c1295376a6d80530635e0095316d0b3ec6ea68; output-bytes=5566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
      even when that account is one side of a pre-existing mixed agreement
  CHECK: npm run verify:api
  EXPECT: all 52 checks passed
  CWD: frontend-react
