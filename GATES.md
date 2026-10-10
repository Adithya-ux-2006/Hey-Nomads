# Gates: Hey Nomads production verification

Scope: Prove the app builds, passes its own verification suites, and ships a
deploy contract that routes API traffic to the backend, before claiming the
hosted product works.

OWNS: frontend-react/scripts/verify-deploy-contract.mjs

- [x] G1: The linter reports no errors, which is the only gate that caught the
      shipped RoommatesPage crash (six identifiers used in JSX but absent from
      the import list; Vite does not flag this, ESLint does)
  CHECK: npx eslint . --max-warnings=0 && echo lint verification passed
  EXPECT: lint verification passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=e3172f20dcca0abec36a21627a1a4fc103d1d87a9913231ef42ab77f82541b5f; exit=0; EXPECT=matched; output-sha256=df4094802875cdfe7d44579e3d881cd392ccfb41d03378b2926cfc112d8db201; output-bytes=26; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G2: The production bundle is emitted and contains an entry document
  CHECK: node scripts/verify-deploy-contract.mjs
  EXPECT: deploy contract verification passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=65706663589694f53e58bba0cb5a2c31f0a9ed72527e0d85fbf7414109ae5a51; exit=0; EXPECT=matched; output-sha256=467c3585552ede8a052140075671fd6576e2f4e0c61ce94391a40cd1d6bbeaf0; output-bytes=97; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G3: A production build succeeds and writes dist/index.html
  CHECK: npm run build
  EXPECT: built in
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a1d2ebbc1b73d4766fbe4a0d940b96e14f2528e36ae08fa35712ebeae4f5eaec; exit=0; EXPECT=matched; output-sha256=390dab01f895504314d04cfd08834d3edff446af3f4afb7840c4e7d3e5979d7b; output-bytes=1090; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G4: The backend security suite passes all of its checks
  CHECK: npm run verify:security
  EXPECT: 10/10 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=acf3681434a4a6e2a68cbcea16cde8261da01f1915dacad18c96112b91d2b20e; exit=0; EXPECT=matched; output-sha256=7b0edefd4608220cc22b53a3ff4edba4b98b0c14f848c15bba8a26811b9d9ab8; output-bytes=5673; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G5: The settlement and resource fixtures resolve working links
  CHECK: npm run verify:fixtures
  EXPECT: all 9 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=1a1aeb42626c8c402df8a98743caef11e52ac9324004f388df9427b2cfdeb429; exit=0; EXPECT=matched; output-sha256=65b0903a685c90faf7cddc941511876c49886f689f7293f91ce01724651f1065; output-bytes=3566; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G6: Auth, onboarding, matching, settlement, events and agreements round-trip
      against the real database
  CHECK: npm run verify:api
  EXPECT: all 21 checks passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=78dda9ff05ee41d7b7db438722ab9ca7697488a865585cb3f00e281658d2671d; exit=0; EXPECT=matched; output-sha256=565090215bc741369b702e61bd427c031a113fa2a6095c9d33c74d32f6fd892a; output-bytes=2429; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [ ] G7: The Netlify deployment actually serves /api/* instead of the SPA shell
  EVIDENCE: pending

<!--
G7 is manual because triggering and observing the hosted Netlify build requires
the maintainer's Netlify account. G2 proves the contract is declared correctly
and that the proxy target is alive; G7 is the only proof that the host honours
it. Do not read G2 as a substitute.

If a gate becomes genuinely impossible, keep the gate and add a column-1 line
`ABANDON: G7 <reason and handoff>`. Abandonment is terminal handoff, never
success, and it is not a way to mark a manual gate as passed.
-->