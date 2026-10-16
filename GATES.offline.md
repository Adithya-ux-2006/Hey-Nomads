# Gates: offline-first photo upload and likes interface

OWNS: frontend-react/api/**, frontend-react/src/**, frontend-react/scripts/gates-offline.mjs,
  frontend-react/scripts/qa-offline-ui.mjs, frontend-react/tests/offline/**,
  frontend-react/package.json, docs/offline-backend-checklist.md, GATES.offline.md

Scope: photo upload never claims success before the server confirms it, a pending
photo survives on the device via IndexedDB with quota and remove handling, the
Likes Sent/Received/Matches screen serves only real database rows with no
synthetic identities, and every offline claim is proven by mocked tests while
backend work blocked by missing storage configuration is handed off in a
checklist.

- [x] G0: this ledger's oracles pass the unlazy ledger lint
  CHECK: node .opencode/skills/unlazy/scripts/gate-lint.mjs GATES.offline.md
  EXPECT: LINT OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=dbf326cd29652b4c9302c922a3340b8c7d9ab126fcd7d9173738061058157ceb; exit=0; EXPECT=matched; output-sha256=48630b7361dd44ee870917b12c3d19b9d7bdea738aaca16bb04d4cab83b772d2; output-bytes=8; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads; path=8c2f10424b45/58 entries

- [x] G1: the frontend linter reports no errors and no warnings
  CHECK: node scripts/gates.mjs lint
  EXPECT: GATE_LINT_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a55c5eee41c8305c9edd9d3aafe108afecb0fa3c68ad4562cdc0863d6cd7e1a2; exit=0; EXPECT=matched; output-sha256=27d4dba1e1bd89d2aaff22e8032c807ae4e07d1f577a30acad21f133622e163d; output-bytes=277; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G2: the production frontend build completes
  CHECK: node scripts/gates.mjs build
  EXPECT: GATE_BUILD_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=0b5f23fc7eea6c0e671a911a9a5a0916ed3dfcc9d6b20887be9a124d3194f9e9; exit=0; EXPECT=matched; output-sha256=a8b61306d85155c4b1814b247786c7db2bdeef445e480ddd65a511cf558902bc; output-bytes=1324; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [ ] G3: offline unit tests pass with mocked fetch and mocked storage (no network,
      no database), covering the upload state machine that cannot reach an
      uploaded state without a server URL, photo type and size validation,
      IndexedDB retention including a simulated quota failure and remove,
      likes selectors that drop blocked and non-real accounts, and the demo
      transport answering /likes paths
  CHECK: node scripts/gates-offline.mjs unit
  EXPECT: GATE_OFFLINE_UNIT_OK
  CWD: frontend-react
  EVIDENCE: pending

- [ ] G4: the real upload route answers offline with the distinct statuses 401
      (no token), 415 (unsupported type), 413 (oversize), 400 (bad magic
      bytes), and 503 (storage not configured) while never calling blob storage
  CHECK: node scripts/gates-offline.mjs upload
  EXPECT: GATE_UPLOAD_GUARDS_OK
  CWD: frontend-react
  EVIDENCE: pending

- [ ] G5: the real likes route rejects unauthenticated callers with 401 before
      any database access, and its query builders carry the real-account and
      blocked-pair filters asserted in unit tests
  CHECK: node scripts/gates-offline.mjs likes
  EXPECT: GATE_LIKES_API_OK
  CWD: frontend-react
  EVIDENCE: pending

- [ ] G6: the route-mocked responsive UI suite passes at 360, 390, and 1440 px
      for the Likes screen (Sent/Received/Matches tabs, empty and populated,
      labelled mocked) and the photo step states (saved on device, uploading,
      uploaded after server success, failure keeps the preview with retry, no
      success text on failure)
  CHECK: node scripts/gates-offline.mjs ui
  EXPECT: GATE_OFFLINE_UI_OK
  CWD: frontend-react
  EVIDENCE: pending

- [ ] G7: docs/offline-backend-checklist.md exists and names every blocked
      backend verification with its exact command or environment variable and a
      positive-control line proving the checker can fail
  CHECK: node scripts/gates-offline.mjs docs
  EXPECT: GATE_CHECKLIST_OK
  CWD: frontend-react
  EVIDENCE: pending

- [ ] G8: the pushed main branch head equals the local head after this work is
      committed
  CHECK: node scripts/gates-offline.mjs push
  EXPECT: GATE_PUSH_OK
  CWD: frontend-react
  EVIDENCE: pending

- [ ] G9: live end-to-end storage upload and live likes queries return real rows
  EVIDENCE: pending

ABANDON: G9 no BLOB_READ_WRITE_TOKEN exists in any environment available to this session, no isolated test database credential is available, and writing to production storage or the production database requires explicit human approval that this offline-first task does not grant; exact reproduction steps are handed off in docs/offline-backend-checklist.md
