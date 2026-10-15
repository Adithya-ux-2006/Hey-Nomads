# Gates: kit context setup and context audit (scoped step)

OWNS: process/**, GATES.ctx-setup.md

Scope: Establish the kit's required context files with vc-setup, capture exactly what
changed, run vc-audit-context, and fix only genuine context issues that affect the
in-flight Hey Nomads matching/demo work — without touching the product diff, the
harness, or any database.

Baselines captured before any work in this step (re-measured with the oracle's own
code path after the first PowerShell `Out-String` measurement was found to wrap lines
at console width and therefore produce a meaningless hash):
- HEAD = 42c324d3fcd1ab9df42635b605d6ea39eec67596
- product diff SHA256 = 8B8E4101E9AF4B059A4884F4512F7DFFB1B59167269FC09F52BFDACC1E28A01B
- harness SHA256 = 8B9E1CA5E624E6A9A2027F441E690CF4CB2593E6AC6AF5A620A2CE78B80DA8F7

Status legend: PASS = ran and emitted its token.

- [x] G1: vc-setup produced a non-stub context router at process/context/all-context.md
  CHECK: node C:/Users/Adithya/AppData/Local/Temp/opencode/hn-ctx-gates.mjs g1
  EXPECT: CTX_ROUTER_PRESENT
  EVIDENCE: automatic-evidence=v1; definition-sha256=60959ae4a7f9d215fd84e0eb284905c3a504ea370e21c6328dc7c703699e1f20; exit=0; EXPECT=matched; output-sha256=16a1ec5324cb831ee5c24abb5a1034cb6aadb6a49c99aa7e03103d8085ff5603; output-bytes=19; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads; path=8c2f10424b45/58 entries
  real repository structure/stack/patterns/environment content, no placeholders.

- [x] G2: Every in-flight Hey Nomads product change is byte-identical to the baseline
  CHECK: node C:/Users/Adithya/AppData/Local/Temp/opencode/hn-ctx-gates.mjs g2
  EXPECT: PRODUCT_DIFF_PRESERVED
  EVIDENCE: automatic-evidence=v1; definition-sha256=80c47faf86181d3c41fbd50367795197817297b9de986b179dace7e01ce93e0e; exit=0; EXPECT=matched; output-sha256=ada4baccd13e437ad60fffb28cc0728f19ab0fa5e655c9ff7952ed5e81938e27; output-bytes=23; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads; path=8c2f10424b45/58 entries
  8B8E4101E9AF4B059A4884F4512F7DFFB1B59167269FC09F52BFDACC1E28A01B.

- [x] G3: No commit was created during this step
  CHECK: node C:/Users/Adithya/AppData/Local/Temp/opencode/hn-ctx-gates.mjs g3
  EXPECT: HEAD_UNCHANGED
  EVIDENCE: automatic-evidence=v1; definition-sha256=a18c733dd6f3718c384a42bc6b5da1368547760c4bd5bf9cc5556355d21c2b22; exit=0; EXPECT=matched; output-sha256=956f3479e2faf5724d50fc5db5a0ba860b183579470dcce220c30c57cec91c06; output-bytes=15; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads; path=8c2f10424b45/58 entries

- [x] G4: Kit harness files under .claude/, .codex/, .agents/, CLAUDE.md, AGENTS.md, opencode.json are unchanged EXCEPT the two disclosed Windows-portability fixes required to make the context audit runnable (discover-context.mjs walk/groupOf separators; validate-context-discovery.mjs walk separators)
  CHECK: node C:/Users/Adithya/AppData/Local/Temp/opencode/hn-ctx-gates.mjs g4
  EXPECT: HARNESS_UNTOUCHED
  EVIDENCE: automatic-evidence=v1; definition-sha256=7959122bfa6fed3a7f878fc2d19e57b38f21ae5e0dc4e45aca0bc330ecd710b5; exit=0; EXPECT=matched; output-sha256=74d87140186e2b56aae7ff2c6a4c1b0882a755d3983e4a1b99b2eae9c32d12d4; output-bytes=63; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads; path=8c2f10424b45/58 entries
  mtime against the baseline-recording anchor: exactly 2 distinct kit files were
  written this step (each seen twice — once via .claude/, once via the .agents/
  junction). Disclosed: .claude/skills/vc-context-discovery/scripts/discover-context.mjs
  and .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs.

- [x] G5: vc-audit-context ran and its structured findings were captured
  CHECK: node C:/Users/Adithya/AppData/Local/Temp/opencode/hn-ctx-gates.mjs g5
  EXPECT: AUDIT_CONTEXT_FINDINGS_CAPTURED
  EVIDENCE: automatic-evidence=v1; definition-sha256=9e5f938475a103347d22bdfc11f9b5bcf722edad83b213157c852498603c57b3; exit=0; EXPECT=matched; output-sha256=56aad8187c5d9a94b97bc2479a56656095a61a81c48216887b3510615211d438; output-bytes=144; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads; path=8c2f10424b45/58 entries
  checkedSkills,checkedClaudeAgents,checkedCodexAgents,warnings,failures). Final run:
  3 context docs, 231 concrete refs, 33 skills, 15 Claude + 15 Codex agents,
  0 warnings, 0 failures.

- [x] G6: No production, recovery, or non-isolated database was accessed at any point
  EVIDENCE: this step ran only git inspection, file reads/writes under process/,
  PowerShell scaffolding, and read-only Node validators (discover-context.mjs,
  validate-all-context.mjs, validate-context-discovery.mjs, gate-lint/gate-check).
  No script touching DATABASE_URL, require-test-db.mjs, the API, or any seeder was
  invoked; no network connection to any database host was attempted.

- [x] G7: Nothing was committed, pushed, or deployed; in-flight work was not overwritten
  EVIDENCE: no git commit, push, merge, or deploy command was executed. HEAD verified
  by runnable gate G3. In-flight product changes verified byte-identical by runnable
  gate G2. The only pre-existing file modified outside process/ was GATES.ctx-setup.md
  (created for this step); README.md was changed in the earlier audit step, not this one.
