# Gates: messaging and agreement authorization

Scope: No surface may offer an action the server refuses, and no user may read
or write another user's private pair data. Both halves are proven against the
real database rather than inferred from reading the routes.

OWNS: frontend-react/api/index.js, frontend-react/src/pages/ShortlistPage.jsx,
  frontend-react/scripts/verify-api-flows.mjs

- [x] A1: POST /api/messages refuses an unmatched pair with 403, and a mutual
      like allows a message that then appears in the conversation
  CHECK: npm run verify:api
  EXPECT: all 28 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=7c56bfec986122acb424ad510b70c47255c9632e8473a38c162d8516096d7df8; exit=0; EXPECT=matched; output-sha256=e9ab4df9a7f612520a033c3b25e82d72b33ac1f1a62ed5e8989af1c550abcd69; output-bytes=3001; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A2: GET /api/shortlist reports is_match, so the client can gate the
      Message action instead of linking to a chat that cannot accept input
  CHECK: npm run verify:api
  EXPECT: all 28 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=7c56bfec986122acb424ad510b70c47255c9632e8473a38c162d8516096d7df8; exit=0; EXPECT=matched; output-sha256=625ccfcccfaf7a5ee9c63593964c792c47466c3172b19d9cd72d186c6ff939ef; output-bytes=3002; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A3: An unrelated signed-in account cannot read an agreement it is not a
      party to, which quotes two people's rent and deposit
  CHECK: npm run verify:api
  EXPECT: all 28 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=7c56bfec986122acb424ad510b70c47255c9632e8473a38c162d8516096d7df8; exit=0; EXPECT=matched; output-sha256=5e3033a415d8b77318fb25481b47bc2cfefc7fb7413617cb18e861deda36b8e4; output-bytes=3002; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A4: An unrelated account cannot write an agreement for other people, and
      the rejected write leaves the stored document unchanged
  CHECK: npm run verify:api
  EXPECT: all 28 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=7c56bfec986122acb424ad510b70c47255c9632e8473a38c162d8516096d7df8; exit=0; EXPECT=matched; output-sha256=317c7fb0aaa34f74fc4ad7eb01786472710643c2b861196e0c9978a70f67507f; output-bytes=3002; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A5: Both parties keep access to their own agreement after the guard, so
      the fix does not lock out the people the feature is for
  CHECK: npm run verify:api
  EXPECT: all 28 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=7c56bfec986122acb424ad510b70c47255c9632e8473a38c162d8516096d7df8; exit=0; EXPECT=matched; output-sha256=8de8f297640c7e05cc7682e80825dd291369df4c63a330a9265c33f2119eacd2; output-bytes=3002; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A6: The linter still reports no errors
  CHECK: npx eslint . --max-warnings=0 && echo lint verification passed
  EXPECT: lint verification passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=e3172f20dcca0abec36a21627a1a4fc103d1d87a9913231ef42ab77f82541b5f; exit=0; EXPECT=matched; output-sha256=df4094802875cdfe7d44579e3d881cd392ccfb41d03378b2926cfc112d8db201; output-bytes=26; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A7: The security suite still passes, since the agreement guard added a
      new 403 path that must not have weakened an existing boundary
  CHECK: npm run verify:security
  EXPECT: 10/10 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=acf3681434a4a6e2a68cbcea16cde8261da01f1915dacad18c96112b91d2b20e; exit=0; EXPECT=matched; output-sha256=7b0edefd4608220cc22b53a3ff4edba4b98b0c14f848c15bba8a26811b9d9ab8; output-bytes=5673; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] A8: The production build succeeds after the API response shape changed,
      because the shortlist UI now branches on the added column
  CHECK: npm run build
  EXPECT: built in
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a1d2ebbc1b73d4766fbe4a0d940b96e14f2528e36ae08fa35712ebeae4f5eaec; exit=0; EXPECT=matched; output-sha256=7118bfae58eba911c248574937779caff3ff86d7efb9d9206bb4f1d8d9be7186; output-bytes=1090; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [ ] A9: The shortlist renders Message only for matches, and an unmatched row
      explains why instead of offering a dead action
  EVIDENCE: pending

<!--
A9 is manual: it needs a signed-in browser session holding one matched and one
unmatched shortlisted user. A2 proves the data the branch reads exists and is
correct; A9 is the only proof the rendered output honours it.

A1 through A5 deliberately share one CHECK. npm run verify:api is a single
command whose suite now contains all five assertions, so one run proves the
whole authorization contract. Splitting them would imply independent evidence
that a single suite run does not provide.
-->