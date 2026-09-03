# Codebase Audit: tests

There are none.

- **Date**: 2026-09-03
- **Scope**: tests
- **Health**: poor
- **Findings**: 1 critical, 2 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🔴 | tests | `package.json:6` | No test runner, no test files, no `test` script anywhere in the repo. Every critical path — auth, book insert, series range creation, external lookup merging — is unverified. `npm run check` proves types line up, not that anything behaves. | Add a runner (Vitest fits Vite with near-zero config) and start with the pure functions. | M |
| 🟡 | tests | `src/lib/series.ts:5` | `parseSeriesVolume` is pure, regex-driven, and drives the series grouping and missing-volume detection the whole Collection view is built on. Two chained regexes with a `length > 1` guard and no coverage. Titles ending in a year ("Akira 1988") or a double number are plausible misparses. | Highest-value first test: a table of title inputs and expected `{series, volume}`. | S |
| 🟡 | tests | `src/lib/bookLookup.ts:482` | `searchByTitle` merges and deduplicates results from four external APIs with per-source timeouts and fallbacks. The most logic-dense function in the codebase, verified only by hand against a few known titles. | Test the merge and dedup logic against recorded fixture responses; leave the network calls out. | M |

## Top actions

1. Add Vitest and one `series.test.ts`. It is under an hour and covers the logic the Collection view depends on most.
2. Extend to `bookLookup`'s merge/dedup with fixtures — no network in tests.
3. Wire `npm test` into `.github/workflows/ci.yml` alongside check and build.

## Coverage

- **Scanned**: tests — critical-path coverage, implementation-coupled assertions, flaky patterns, skipped tests, pyramid balance. Confirmed zero test files exist under `src/` or elsewhere.
- **Skipped**: no coverage tool, static inspection only. Pyramid balance, flakiness, and skipped-test checks are vacuous with no suite; no coverage numbers were invented.
