# Testing

## Strategy

- No automated tests exist. Verification is manual: `npm run dev`, then exercise the flow in the browser.
- The typecheck (`npm run check`, see `coding-assertions.md`) is the only mechanical safety net.

## Conventions

- Pure logic that would be worth testing first lives in `src/lib/*.ts` (`series.ts`, `bookLookup.ts`), not in the `.svelte` files. Keep it there.
- External lookups need real network calls, so they are checked by hand against a few known ISBNs and titles per category.
