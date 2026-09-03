# Codebase Audit: ui

States are handled better than most projects this size; the gaps are failure states and one dead screen.

- **Date**: 2026-09-03
- **Scope**: ui
- **Health**: fair
- **Findings**: 0 critical, 3 warning, 2 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | ui | `src/lib/views/Collection.svelte:228` | No error state. A failed fetch falls through to "Ta bibliothèque est vide." — the app tells you your library is empty when the network is down. Worst possible message for the situation. | Add a distinct error branch with a retry action. | S |
| 🟡 | ui | `src/lib/views/BookDetail.svelte:80` | Saving a rating or review gives no failure feedback: on error the handler returns and the panel still shows the edited values, so the user believes it saved. Delete at line 91 behaves the same. | Show an inline error and revert the optimistic state. | S |
| 🟡 | ui | `src/lib/views/Stats.svelte:81` | No error state — a failed fetch renders zeroes as though the library were genuinely empty. | Same as Collection. | S |
| 🟢 | ui | `src/lib/views/Planning.svelte:9` | `Planning` is a permanent "Bientôt disponible." placeholder, but `TopNav` gives it equal billing with real screens. Users pay a nav slot for nothing. | Hide the entry until the screen does something. | S |
| 🟢 | ui | `DESIGN_GUIDELINES.md:3` | The guidelines forbid default Tailwind palette classes, but `text-slate-*` is used throughout all nine views as the de-facto text ramp, and `text-red-500` is the standard error colour. The rule as written is already broken everywhere. | Either add slate and the error red to `tailwind.config.js` as named tokens, or amend the rule to name the sanctioned exceptions. | S |

Healthy and worth recording: every `<img>` in the codebase has an `alt` attribute (9 of 9). Loading states exist in Collection and Stats, empty states are written for both the no-results and never-added cases, and covers consistently hold `aspect-[2/3]` with `cover-shadow` per the guidelines. Dark and light variants are paired on every colour utility examined. `TopNav` renders both the desktop sidebar and the mobile bottom bar from one component rather than duplicating markup.

## Top actions

1. Add error states to the three async surfaces. They share one root cause with the `code-quality` findings: the Supabase `error` field is discarded, so the UI has nothing to render.
2. Reconcile `DESIGN_GUIDELINES.md` with the slate ramp the code actually uses — a rule broken everywhere teaches the next contributor to ignore the document.

## Coverage

- **Scanned**: ui — loading/error/empty states, visual hierarchy, design-token drift, responsive markup, accessibility (alt text, aria, keyboard affordances) by static inspection across all nine views.
- **Skipped**: no URL provided, runtime a11y pass skipped, static inspection only. Contrast ratios were not computed and keyboard navigation was not exercised; no runtime findings were inferred.
