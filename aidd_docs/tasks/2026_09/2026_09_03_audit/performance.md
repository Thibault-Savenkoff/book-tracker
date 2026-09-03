# Codebase Audit: performance

Lazy-loading the scanner was the right call, then the service worker precaches it anyway.

- **Date**: 2026-09-03
- **Scope**: performance
- **Health**: fair
- **Findings**: 0 critical, 3 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | performance | `src/lib/views/AddBook.svelte:393` | N+1 insert: `addSeriesRange` awaits one `INSERT` per volume in a sequential loop. Adding a 100-volume manga is 100 round-trips, and a failure halfway leaves a partially-created series with no feedback. | One `.insert([...rows])` call — `supabase-js` accepts an array. Turns 100 requests into 1 and makes it atomic. | S |
| 🟡 | performance | `vite.config.ts:31` | `globPatterns: ['**/*.{js,css,html,svg,png,ico}']` precaches every chunk, including the 369 KB lazy-loaded `html5-qrcode` bundle. 776 KB is downloaded on install, defeating the dynamic `import()` at line 333 of `AddBook.svelte`. | Exclude the scanner chunk from `globPatterns`, or let Workbox runtime-cache it on first use. | S |
| 🟡 | performance | `src/lib/views/Stats.svelte:17` | `select('*')` fetches every column of every book — including `review`, the largest free-text field — to compute counts and page sums. It also re-fetches data `booksStore` already holds. | Select only the columns the aggregates need, or read from `booksStore`. | S |
| 🟢 | performance | `src/lib/views/Collection.svelte:14` | Unbounded `select('*')` with no pagination. Supabase caps responses at `max_rows = 1000` (`supabase/config.toml:17`), so a library past 1000 books silently truncates rather than erroring. | Paginate with `.range()`, or at minimum detect the 1000-row boundary. | M |

Bundle, measured from `npm run build`: `index.js` 353 KB (96 KB gzip), `index.css` 48 KB (8 KB gzip), scanner chunk 369 KB (109 KB gzip) correctly split out. Nothing duplicated across chunks.

The `seriesGroups` computation in `Collection.svelte:41` uses `volumes.includes(n)` inside a min-to-max loop — quadratic in the worst case, but bounded by one series' volume count, so it is not worth changing.

## Top actions

1. Batch the series insert — one line, removes the worst latency path in the app.
2. Keep the scanner chunk out of the precache; it is over half the install payload for a feature most sessions never open.

## Coverage

- **Scanned**: performance — N+1 queries, unbatched operations, unpaginated payloads, bundle size (real build output), render thrash, memoization on hot paths.
- **Skipped**: no profiler and no bundle analyzer configured; static heuristics plus measured build output only. No runtime measurements were taken.
