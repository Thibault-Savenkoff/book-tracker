# Codebase Audit: dependencies

Lean, current, MIT-clean. One build-time transitive CVE and two dead devDependencies.

- **Date**: 2026-09-03
- **Scope**: dependencies
- **Health**: good
- **Findings**: 0 critical, 1 warning, 3 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | dependencies | `package.json:20` | `npm audit`: 1 high CVE in `fast-uri` (SSRF and host confusion), reached via `vite-plugin-pwa > workbox-build > ajv`. Build-time only — it never enters the client bundle — so exposure is limited to the build host. A fix is available. | `npm audit fix`, then re-run `npm run build`. | S |
| 🟢 | dependencies | `package.json:16` | `autoprefixer` is declared but unused. Tailwind v4 via `@tailwindcss/vite` handles prefixing, and there is no `postcss.config.*` in the repo. | Remove from devDependencies. | S |
| 🟢 | dependencies | `package.json:17` | `postcss` is declared but unused, for the same reason. | Remove from devDependencies. | S |
| 🟢 | dependencies | `package.json:22` | `typescript` pinned `~6.0.2` while 7.0.2 is out; `@types/node` is on 24 against 26. Not urgent, but the gap grows. | Plan a major bump; TypeScript 7 needs its own verification pass. | M |

Healthy and worth recording: `package-lock.json` is committed, every entry carries an integrity hash, and there are no git or URL dependencies. Licenses across the installed tree are 337 MIT, 14 ISC, 10 Apache-2.0, plus a handful of BSD/BlueOak/MPL — no GPL, AGPL, or unlicensed package. Only 2 runtime dependencies (`@supabase/supabase-js`, `html5-qrcode`), which is genuinely disciplined. `@supabase/supabase-js`, `svelte`, and `vite` are all one patch behind latest.

## Top actions

1. `npm audit fix` for the `fast-uri` advisory, then confirm the build still passes.
2. Drop `autoprefixer` and `postcss` — two dependencies that do nothing.

## Coverage

- **Scanned**: dependencies — CVEs (`npm audit`), licenses (walked the installed tree), outdated packages (`npm outdated`), unused declared dependencies, lockfile integrity and supply chain.
- **Skipped**: none.
