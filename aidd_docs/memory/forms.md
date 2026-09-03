# Forms

## Approach

- Plain HTML inputs bound with Svelte 5 runes. No form library, no validation library, no shared form abstraction.
- Each screen owns its own local state and its own submit handler.

## Conventions

- Validation is whatever the database enforces plus a light check at the input: rating 0-5, `pages_read >= 0`, status in the allowed set. The Postgres `check` constraints in `supabase/migrations/` are the real guard.
- Errors surface as inline text in the view that raised them; there is no toast or global error channel.
- Network failures from book lookup are typed (`LookupNetworkError` in `src/lib/bookLookup.ts`) so the UI can tell "nothing found" apart from "the request failed".
