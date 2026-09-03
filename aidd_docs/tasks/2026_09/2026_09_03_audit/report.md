# Codebase Audit: all seven pillars

A small, disciplined codebase with two real holes: an auth redirect wildcard that can leak sessions, and no tests at all.

- **Date**: 2026-09-03
- **Scope**: all seven pillars (code-quality, architecture, security, dependencies, performance, tests, ui)
- **Health**: fair
- **Findings**: 2 critical, 18 warning, 11 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🔴 | security | `supabase/config.toml:158` | `additional_redirect_urls` contains `https://*.vercel.app`. An auth code can be redirected to any Vercel app and exchanged for a session. | Replace the wildcard with exact production URLs. | S |
| 🔴 | tests | `package.json:6` | No test runner, no test files, no `test` script. Every critical path is unverified. | Add Vitest; start with the pure functions. | M |
| 🟡 | security | `supabase/functions/comicvine-search/index.ts:3` | Wildcard CORS and no JWT check: an open relay carrying `COMICVINE_API_KEY`. | Restrict CORS to the app origin and require the Supabase JWT. | S |
| 🟡 | security | `supabase/config.toml:186` | `enable_signup = true`, no captcha, on a single-user app. | Disable signup or add a captcha. | S |
| 🟡 | security | `supabase/config.toml:150` | `site_url` is a Tailscale host, so auth emails link off-tailnet to nowhere. | Point it at the Vercel production URL. | S |
| 🟡 | performance | `src/lib/views/AddBook.svelte:393` | N+1 insert: one `INSERT` per volume in a sequential loop; partial failure leaves a half-created series. | Single `.insert([...rows])`. | S |
| 🟡 | performance | `vite.config.ts:31` | Service worker precaches the 369 KB lazy scanner chunk, defeating its own code-split. | Exclude it from `globPatterns`. | S |
| 🟡 | performance | `src/lib/views/Stats.svelte:17` | `select('*')` pulls every column, including `review`, just to compute aggregates. | Select only what the aggregates need. | S |
| 🟡 | code-quality | `src/lib/views/BookDetail.svelte:80` | `if (error) return` — save and delete fail silently while the UI shows success. | Surface the error, revert local state. | S |
| 🟡 | code-quality | `src/lib/views/Collection.svelte:14` | Supabase `error` discarded; a failed fetch is indistinguishable from an empty library. | Destructure `error`, render an error state. | S |
| 🟡 | code-quality | `src/lib/views/Stats.svelte:17` | Same discarded error; zeroed stats look real. | Same fix. | S |
| 🟡 | code-quality | `src/lib/views/AddBook.svelte:132` | `.maybeSingle()` errors on duplicate ISBNs — a case `is_collector_edition` explicitly supports — and the error is discarded. | Use `.limit(1)` or handle multi-row. | S |
| 🟡 | architecture | `src/lib/views/AddBook.svelte:1` | God-component: 1013 lines, 33% of all source, owning seven distinct concerns. | Split scanner, series building, and cover picking out. | L |
| 🟡 | architecture | `src/lib/views/Collection.svelte:15` | `booksStore` has no real owner; it works only because the view switch remounts Collection. | Give the store ownership of load and mutation. | M |
| 🟡 | ui | `src/lib/views/Collection.svelte:228` | No error state — the app claims your library is empty when the network is down. | Add an error branch with retry. | S |
| 🟡 | ui | `src/lib/views/BookDetail.svelte:80` | No failure feedback on save or delete. | Inline error, revert optimistic state. | S |
| 🟡 | ui | `src/lib/views/Stats.svelte:81` | No error state. | Same as Collection. | S |
| 🟡 | dependencies | `package.json:20` | 1 high CVE in `fast-uri` via `vite-plugin-pwa > workbox-build > ajv`. Build-time only; fix available. | `npm audit fix`, re-run the build. | S |
| 🟡 | tests | `src/lib/series.ts:5` | `parseSeriesVolume` drives all series grouping; two chained regexes, zero coverage. | Table-driven test of title inputs. | S |
| 🟡 | tests | `src/lib/bookLookup.ts:482` | Four-API merge and dedup, the densest logic in the repo, hand-verified only. | Test merge/dedup against fixtures. | M |
| 🟢 | code-quality | `src/lib/views/AddBook.svelte:389` | `addSeriesRange` mixes four responsibilities in one loop body. | Extract a pure row builder. | M |
| 🟢 | code-quality | `src/lib/views/Planning.svelte:1` | Empty `<script>` block. | Delete it. | S |
| 🟢 | architecture | `src/lib/views/AddBook.svelte:333` | Two scanner instances with duplicated lifecycles in one file. | One scanner helper with a target parameter. | M |
| 🟢 | performance | `src/lib/views/Collection.svelte:14` | Unbounded `select('*')`; silently truncates at `max_rows = 1000`. | Paginate, or detect the boundary. | M |
| 🟢 | ui | `src/lib/views/Planning.svelte:9` | Permanent placeholder screen holding a full nav slot. | Hide it until it does something. | S |
| 🟢 | ui | `DESIGN_GUIDELINES.md:3` | The no-default-palette rule is broken by `text-slate-*` in all nine views. | Tokenise slate, or amend the rule. | S |
| 🟢 | security | `supabase/config.toml:194` | `minimum_password_length = 6`, no complexity requirement. | Raise to 8+, set a requirement. | S |
| 🟢 | security | `src/lib/supabase.ts:6` | No guard on missing env vars; a bad deploy fails opaquely. | Throw a named error. | S |
| 🟢 | dependencies | `package.json:16` | `autoprefixer` declared but unused (Tailwind v4, no `postcss.config`). | Remove. | S |
| 🟢 | dependencies | `package.json:17` | `postcss` declared but unused. | Remove. | S |
| 🟢 | dependencies | `package.json:22` | `typescript` on 6.0 against 7.0; `@types/node` on 24 against 26. | Plan a major bump. | M |

## Top actions

1. **Fix the auth redirect wildcard** (`supabase/config.toml:158`). Session-leak risk, five-minute fix, nothing else in this list can hurt you as much. Verify the live dashboard setting too — config.toml may not reflect it.
2. **Stop discarding Supabase errors.** One mistake repeated in four places (`Collection:14`, `Stats:17`, `BookDetail:80,91`, `AddBook:132`) that is simultaneously the root cause of three `ui` findings. Fixing it once fixes seven rows.
3. **Add Vitest and test `parseSeriesVolume`.** Under an hour, covers the logic the entire Collection view rests on, and gives CI something to run beyond typecheck.
4. **Batch the series insert and unprecache the scanner chunk.** Two one-line changes, the two biggest measurable performance wins.
5. **Close the Comic Vine relay** (CORS origin + JWT) and turn off open signup.
6. **Split `AddBook.svelte`** when you next touch the add flow. Not urgent, but it is 33% of the codebase and every add-flow change routes through it.

Hand off fixes to `aidd-dev:07-refactor` (rows 1-2, 4-5), `aidd-dev:06-test` (row 3), and `aidd-dev:01-plan` for the `AddBook` split. This audit changed no code.

## Coverage

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests, ui — all seven.
- **Skipped**: none skipped outright. Partial coverage, per pillar: no SAST tool (security, static only, and live cloud auth settings unverified); no unused-export tool (code-quality); no ADRs or C4 (architecture, checked against `aidd_docs/memory/` instead); no profiler or bundle analyzer (performance, static heuristics plus measured build output); no coverage tool (tests, static inspection); no URL for a runtime a11y pass (ui, static inspection, contrast ratios not computed).
