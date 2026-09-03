# Coding Assertions

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm run check` | Svelte + TypeScript typecheck (`svelte-check` and `tsc`) |
| 2 | `npm test` | Unit tests for the pure logic in `src/lib/` |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm run check` | typecheck |
| 2 | `npm test` | unit tests |
| 3 | `npm run build` | production Vite + PWA build |

CI (`.github/workflows/ci.yml`) runs all three on push to `main` and on pull requests.

There is no linter and no formatter.
