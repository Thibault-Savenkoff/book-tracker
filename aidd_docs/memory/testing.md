# Testing

## Strategy

- Node's built-in test runner (`node:test` + `node:assert`), run through TypeScript type-stripping. No test framework is installed and none is needed: the project has zero test dependencies.
- Coverage is deliberately narrow: the pure logic in `src/lib/*.ts`. Components and network calls are still verified by hand in the browser.

## Conventions

- Tests live beside their subject as `src/lib/<name>.test.ts`.
- They are excluded from `tsconfig.app.json` and typed by `tsconfig.node.json` instead, which already carries the node types and `allowImportingTsExtensions`. A test therefore imports its subject with the explicit `.ts` extension.
- Table-driven where the input space is a list of shapes. Known parser limits are pinned as tests too, so a regex change surfaces as a failure rather than silent drift.
- No mocking and no network in tests. Anything needing a live API is checked by hand.

## Run

- `npm test` — the whole suite.
- Runs in CI between `npm run check` and `npm run build`.
