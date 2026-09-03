# Codebase Audit: code-quality

Small, readable codebase with genuinely useful comments, spoiled by one 1000-line component and swallowed errors.

- **Date**: 2026-09-03
- **Scope**: code-quality
- **Health**: fair
- **Findings**: 0 critical, 4 warning, 2 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | code-quality | `src/lib/views/BookDetail.svelte:80` | `if (error) return` after the book update. The save silently does nothing on failure and the UI still shows the new values. Same pattern on delete at line 91. | Surface the error in the panel; keep the local state unchanged on failure. | S |
| 🟡 | code-quality | `src/lib/views/Collection.svelte:14` | `const { data } = await ...` discards the error. A failed fetch renders "Ta bibliothèque est vide." — indistinguishable from an actually empty library. | Destructure `error` and render a distinct error state. | S |
| 🟡 | code-quality | `src/lib/views/Stats.svelte:17` | Same discarded error as Collection: a failed fetch shows zeroed stats as if they were real. | Same fix. | S |
| 🟡 | code-quality | `src/lib/views/AddBook.svelte:132` | `.eq('isbn', isbn).maybeSingle()` errors when more than one row matches, and the error is discarded. Owning two editions of one ISBN (the app has `is_collector_edition`, so this is expected) silently breaks the already-owned check. | Use `.limit(1)` and take the first row, or handle the multi-row case explicitly. | S |
| 🟢 | code-quality | `src/lib/views/AddBook.svelte:389` | `addSeriesRange` mixes fallback construction, cover selection, collector renaming, and insertion in one loop body. Hard to follow, impossible to test. | Extract the per-volume row builder as a pure function in `src/lib/`. | M |
| 🟢 | code-quality | `src/lib/views/Planning.svelte:1` | Empty `<script>` block on a placeholder screen. | Delete the empty block. | S |

Not found, worth recording: no dead exports, no stale TODOs, no magic numbers of consequence. The comments in `bookLookup.ts`, `series.ts`, and `booksStore.ts` explain *why* rather than *what*, which is the right instinct — keep it.

## Top actions

1. Stop discarding Supabase errors in the four locations above. This is the same one-line mistake repeated and it hides real failures from you in production.
2. Fix the `maybeSingle()` duplicate-ISBN path — it breaks a case the schema explicitly supports.
3. Extract the series row builder out of `AddBook.svelte` when you next touch it.

## Coverage

- **Scanned**: code-quality — naming, SOLID, DRY, readability, smells, dead code, unused exports, TODOs, complexity, file and function length, error handling.
- **Skipped**: no unused-export tool (knip, ts-prune) installed; dead-code findings are from manual cross-referencing only.
