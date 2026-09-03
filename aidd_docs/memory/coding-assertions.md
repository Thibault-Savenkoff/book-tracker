# Coding Assertions

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm run check` | Svelte + TypeScript typecheck (`svelte-check` and `tsc`) |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm run check` | typecheck |
| 2 | `npm run build` | production Vite + PWA build |

There is no linter, no formatter, and no test runner wired up. `npm run check` is the only automated gate that exists.
