# Gates: QA baseline, write-path safety, Apple Design redesign, journey, presentation

OWNS: frontend-react/api/**, frontend-react/src/**, frontend-react/scripts/**, GATES.qa-redesign.md

Scope: finish the interrupted QA against the isolated test database, clear the
write-path audit failure, correct visible UI defects using the Apple Design
skills, verify the complete real journey in a browser, and only then build the
competition presentation experience.

Status legend: PASS = ran and emitted its token. BLOCKED = command could not run.
No gate is marked PASS without output from the command named in CHECK.

- [x] Q1: Local QA harness runs every local browser suite against the isolated test database, starting and stopping both servers cleanly — PASS
  CHECK: node scripts/qa-local.mjs
  EXPECT: QA_LOCAL_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=25e887bc440f45a21ac764ec4eb2bb07d04d0cf42f905cae4f3483abf1b3af6e; exit=0; EXPECT=matched; output-sha256=3238c1beb15d1b2541d73bdb11d15c100556c3d45bbe6a6d2ebe434961eb261d; output-bytes=6207; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q2: Browser QA covers landing, login, demo, discover, matches and chat with no failure — PASS
  CHECK: node scripts/qa-local.mjs --suite browser
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=cf378752dd520ab7f383ca5c8f6b4dbebf9fd955d04f704cea3c9e66e39c6f86; exit=0; EXPECT=matched; output-sha256=a088f5634264f1fea9621d8e829af7ef3d5729a0caa8127ff47c438475016cdf; output-bytes=2583; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q3: Profile layout QA confirms the header does not clip or overflow at 1440px and 390px — PASS
  CHECK: node scripts/qa-local.mjs --suite profile
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=597e04bdf2addbd5d8cfa321b8a8a5ae2464eac643127bdca980ff96cd96e3c4; exit=0; EXPECT=matched; output-sha256=ae9e65ff9c939813a1aff4d9883679535e2f1f8e5fc46159526cf43dd9c60c00; output-bytes=3676; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q4: Write-path audit reports zero unguarded writers — PASS
  CHECK: node --import ./scripts/dns-shim.mjs scripts/audit-write-paths.mjs
  EXPECT: 0 unguarded writer
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=d4fe24096d94908e91a662162db54b2ca6d76fce56dc629687c94d71af59b4e8; exit=0; EXPECT=matched; output-sha256=94fdca3f668f6c72b079f29506dac164c358f1aff2509bcb7582383ea7d27928; output-bytes=3090; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q5: Demo tour still passes after every later change — PASS
  CHECK: node scripts/demo-tour-qa.mjs
  EXPECT: /demo tour qa passed - all \d+ checks/
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a7eb8ef4345c75dfb92ab81ebd5e36479eb45bb22ea151db0932454a5bf7c49d; exit=0; EXPECT=matched; output-sha256=c5b39ba5e35952c0a679c76ec6ed10ecccce2dd57247f297babb749336b829f3; output-bytes=1411; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q6: Matching regression still passes after every later change — PASS
  CHECK: node --import ./scripts/dns-shim.mjs scripts/verify-matching.mjs
  EXPECT: matching regression passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=16c896befc1aad1695c5e2b0481e9a1d942fa3188ac80c3c3b3356585ca6486e; exit=0; EXPECT=matched; output-sha256=4b4b5ebb0ca53d82b089f251e124fa6804fc51ad67b2030902a45ff40008482a; output-bytes=1676; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q7: API authorisation, matching, chat and agreement flows still pass — PASS
  CHECK: node --import ./scripts/dns-shim.mjs scripts/verify-api-flows.mjs
  EXPECT: /all \d+ checks passed/
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=18ed387c7dfcb4c7dc9492c75221b842a48c12ce212b40da1dbacb7d421d22aa; exit=0; EXPECT=matched; output-sha256=4b3bb86438ccb452d869f1522fbafaaf9075c81609d4acbbc302214a24da1617; output-bytes=5869; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q8: Profile, Discover, auth and chat screens were inspected at 1440px and 390px and the visible defects found there were corrected — PASS
  CHECK: node scripts/qa-local.mjs --suite ui
  EXPECT: ui inspection passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a6cfefef2da0ac1203de9fa96b9c8ae9482c28303b2da5b19948953bfde635be; exit=0; EXPECT=matched; output-sha256=6b7007547f80063bda7c3bf86e4acb77352ad0531d1f1d7c954c56b8e87f98b6; output-bytes=6155; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q9: Complete real journey verified end to end in a browser — PASS
  CHECK: node scripts/qa-local.mjs --suite journey
  EXPECT: ui walkthrough passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a321fbe81a50eb2759f4099a9dfec046c96d66a3d6e214216fb8d3759f9f9782; exit=0; EXPECT=matched; output-sha256=404ce10580eabcc7ea365b2f0a238b18ec7873d9c30b3f4ae00efc8943c50ea1; output-bytes=3269; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q10: Competition presentation mode runs on isolated synthetic accounts and the real matching logic, exposing no real user or private data — PASS
  CHECK: node scripts/qa-presentation.mjs
  EXPECT: PRESENTATION_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=cda32fe226eb4e27fd71df3cc6e946643ee2ccf2dc59ff89d2237559eb7b4f41; exit=0; EXPECT=matched; output-sha256=d802edf7c78300d0187b4b79ef91a2a90d1f05c826c45941794df30febae974b; output-bytes=1724; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q11: The guided presentation walkthrough takes a visitor from the public intro through Discover, a scored profile, a mutual match, Matches and a sent reply, with no credential or developer control visible at any step
  CHECK: node scripts/qa-local.mjs --suite walk
  EXPECT: /PRESENTATION_UI_OK/
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=94dc271527629fef8a9010d3699e472cf1935cf1df1d9ad4cb3cabea57a6a013; exit=0; EXPECT=matched; output-sha256=330dbed63d22280456271bac9b1a1e627e14d4d008394cdbbce79cbe143e94c4; output-bytes=1318; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] Q12: The presentation surface is authorised at both ends: a scoped token is issued only when the cohort is ready, is refused by every ordinary endpoint, and an ordinary token is refused by every presentation route while no admin or seed control is reachable
  CHECK: node scripts/qa-local.mjs --suite flow
  EXPECT: /PRESENTATION_FLOW_OK/
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=b448ed0929a3cbffb4636a2ea8e73807894582727a0c4bdae04fd2685d0f7f4d; exit=0; EXPECT=matched; output-sha256=287e36feecef29f191d08fcf1141d8b48d90a874f15018d280a3bdaa5c314565; output-bytes=2237; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries
