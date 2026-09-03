# Codebase Audit: architecture

The documented architecture holds everywhere except one component that has absorbed a third of the codebase.

- **Date**: 2026-09-03
- **Scope**: architecture
- **Health**: fair
- **Findings**: 0 critical, 2 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | architecture | `src/lib/views/AddBook.svelte:1` | God-component: 1013 lines, 33% of all source. It owns ISBN lookup, title search, alias expansion, series range building, two independent barcode scanners, a cover picker, and every insert path. Every add-flow change goes through this one file. | Split by concern: scanner lifecycle into `src/lib/scanner.ts`, series range building into `src/lib/`, cover picking into its own component. | L |
| 🟡 | architecture | `src/lib/views/Collection.svelte:15` | `booksStore` is documented as a read-only mirror, but `Collection` is its sole writer and the load runs on mount. Any other screen mutating a book (`BookDetail`) leaves the store stale until Collection remounts. It works today only because the view switch remounts the component. | Move the load and the mutations behind the store so ownership is explicit. | M |
| 🟢 | architecture | `src/lib/views/AddBook.svelte:333` | Two separate scanner instances (`volumeHtml5QrCode`, `html5QrCode`) with duplicated start/stop lifecycles in one file. | Collapse to one scanner helper with a target parameter. | M |

Conformance: the stack, layering, and boundaries match `aidd_docs/memory/architecture.md` and `codebase-map.md`. No circular imports, no view importing another view's internals, no business logic in `main.ts` or `App.svelte`. The deliberate "no router, no data layer" decisions are respected consistently rather than half-applied.

## Top actions

1. Break up `AddBook.svelte` — it is the single largest structural risk in the repo.
2. Give `booksStore` real ownership of loading and mutation, or drop it and let each view query.

## Coverage

- **Scanned**: architecture — conformance against `aidd_docs/memory/`, coupling, dependency direction, god-modules.
- **Skipped**: no ADRs or C4 diagrams exist; conformance was checked against the memory bank instead.
