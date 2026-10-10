# Gates: like, match feedback, agreements, demo mode

Scope: Make Like work and be visible, give Agreements its own surface, and add an
explicit Demo Mode that cannot masquerade as real users or contaminate real
matches, messages or agreements.

OWNS: frontend-react/api/index.js, frontend-react/src/pages/RoommatesPage.jsx,
  frontend-react/src/pages/MatchesPage.jsx, frontend-react/src/pages/ComparePage.jsx,
  frontend-react/src/components/Navbar.jsx, frontend-react/scripts/verify-api-flows.mjs,
  frontend-react/src/pages/DemoModePage.jsx, frontend-react/src/pages/AgreementsPage.jsx

- [x] L1: A swipe reaches the server as an object, not a double-encoded JSON
      string. This is the regression that shipped: RoommatesPage stringified the
      body and apiFetch stringified it again, so targetId was undefined and
      /api/swipe returned 400.
  CHECK: npm run verify:api
  EXPECT: all 35 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=1771b92d84a176e9d455acf2d291251a3f03c3caf26b6829d4190a2c262f7696; exit=0; EXPECT=matched; output-sha256=363b43e7f4e6fae2f5f7ed3af41035a3179eb8795da777a297dad9d7ba78108f; output-bytes=3687; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] L2: A like persists a real swipe row, and a mutual like persists a match
  CHECK: npm run verify:api
  EXPECT: all 35 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=1771b92d84a176e9d455acf2d291251a3f03c3caf26b6829d4190a2c262f7696; exit=0; EXPECT=matched; output-sha256=6217cc3ed66e2aa225def7c0c3659e9866e04b707e077a421b1f64ef52945436; output-bytes=3685; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] L3: GET /api/agreements lists only agreements the caller is a party to
  CHECK: npm run verify:api
  EXPECT: all 35 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=1771b92d84a176e9d455acf2d291251a3f03c3caf26b6829d4190a2c262f7696; exit=0; EXPECT=matched; output-sha256=611cbd7a545290dcb1e7a412891905d96b3b9da4accb8bffc8df8a9b0208629c; output-bytes=3686; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] L4: Demo Mode is a separate, labelled surface: a demo account is never
      returned as a real recommendation, and a demo interaction writes no match,
      message or agreement row
  CHECK: npm run verify:api
  EXPECT: all 35 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=1771b92d84a176e9d455acf2d291251a3f03c3caf26b6829d4190a2c262f7696; exit=0; EXPECT=matched; output-sha256=2252923724a28be84821191d8d77ef410286e8ff4a0a20dde270fe16369e9fe7; output-bytes=3687; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] L5: The linter reports no errors
  CHECK: npx eslint . --max-warnings=0 && echo lint verification passed
  EXPECT: lint verification passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=e3172f20dcca0abec36a21627a1a4fc103d1d87a9913231ef42ab77f82541b5f; exit=0; EXPECT=matched; output-sha256=df4094802875cdfe7d44579e3d881cd392ccfb41d03378b2926cfc112d8db201; output-bytes=26; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] L6: The production build succeeds
  CHECK: npm run build
  EXPECT: built in
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a1d2ebbc1b73d4766fbe4a0d940b96e14f2528e36ae08fa35712ebeae4f5eaec; exit=0; EXPECT=matched; output-sha256=7dfb1e39508ffc4e0fdbeee46da16b8ec64d89ad245dee01fa3506a0f5059ab3; output-bytes=1090; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] L7: Security and fixtures suites still pass after the new endpoints
  CHECK: npm run verify:security
  EXPECT: 10/10 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=acf3681434a4a6e2a68cbcea16cde8261da01f1915dacad18c96112b91d2b20e; exit=0; EXPECT=matched; output-sha256=7b0edefd4608220cc22b53a3ff4edba4b98b0c14f848c15bba8a26811b9d9ab8; output-bytes=5673; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [ ] L8: A like on a mutual partner shows a matched state with working Message
      and Agreement links, and a plain like does not claim a match
  EVIDENCE: pending

<!--
L8 is manual: it needs a signed-in browser session and a live like interaction.
L1 and L2 prove the request and persistence; L8 is the only proof the rendered
outcome distinguishes like, match and failure.

L1 through L4 share one CHECK on purpose. npm run verify:api is a single command
whose suite contains all four assertions, so one run proves the whole contract
rather than implying coverage a partial suite run does not provide.
-->