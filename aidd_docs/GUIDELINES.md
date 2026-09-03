# AI Operating Guidelines

How this project drives AI coding assistants. Solo project, no reviewer, so the guardrails have to be in here.

## House rules

- Svelte 5 runes only. `export let` and `$:` are rejected on sight. `DESIGN_GUIDELINES.md` is binding for anything visual: no default Tailwind palette classes, tokens from `tailwind.config.js` only.
- Every schema change is two edits, not one: a new file in `supabase/migrations/` and the same change folded into `supabase/schema.sql`. A migration alone silently breaks a fresh install.
- Row shapes in `src/lib/supabase.ts` are hand-written. A column added without updating `Book` or `Quote` is a typecheck that passes and a runtime that lies.
- Keep testable logic in `src/lib/*.ts`, not in `.svelte` files. There is no test runner yet; that split is what makes adding one cheap later.
- Never weaken RLS. Authorization lives in Postgres policies, and the client is not allowed to set `user_id`.
- Never commit real keys. `COMICVINE_API_KEY` is a Supabase function secret and must not reach the client bundle; only `VITE_*` vars are public by design.

## Validation depth

- Every change: `npm run check` must be green. It is the only automated gate that exists.
- Anything touching the UI, the barcode scanner, or `bookLookup.ts`: run `npm run dev` and exercise the flow by hand. The typecheck cannot see a broken layout or a dead API source.
- Before a deploy: `npm run build`. Vercel builds on push without running the typecheck, so a broken build is found in production otherwise.
- A migration is applied by hand in the Supabase SQL editor against the one live database. There is no staging and no rollback — read the SQL twice before running it.

## Commits and history

- `git-sync` auto-commits and pushes `main` on a timer. Work is public within minutes and there is no review step, so nothing half-finished should sit in the working tree longer than it has to.
- The `WIP: auto-sync` log is a backup trail, not history. Don't try to read intent from it, and don't rewrite it.

## When the AI drifts

- Symptom: it invents Supabase columns, reaches for a router, or adds a dependency for something the stdlib does. Reset the session and restate the objective in one sentence.
- Point it at `aidd_docs/memory/` before the code. The memory bank is the fastest correction for wrong assumptions about the stack.
- If it proposes a component library, a state manager, or a test framework, the answer is no unless it was asked for explicitly.

For the general AIDD playbook (planning, review loops, prompting and context hygiene, anti-patterns), see the framework docs: <https://github.com/ai-driven-dev/framework>.
