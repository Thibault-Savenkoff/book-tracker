# Deployment

## Pipeline

- GitHub Actions (`.github/workflows/ci.yml`) runs `npm run check`, `npm test`, then `npm run build` on every push to `main` and on pull requests. It is a signal, not a gate: Vercel deploys in parallel and does not wait for it.
- Vercel is connected to the GitHub repo and builds on push to `main` with the Vite preset (`npm run build` to `dist/`).
- The Supabase side is deployed by hand: migrations pasted into the SQL editor, the edge function pushed with the Supabase CLI.

## Environments

- Production only: the Vercel deployment. Local dev is `npm run dev`. There is no staging.
- Both point at the same Supabase project — there is no separate dev database, so a migration is live the moment it is applied.

## Configuration

- Client env vars, set in `.env` locally and in Vercel project settings: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_BOOKS_API_KEY` (optional). See `.env.example`.
- `COMICVINE_API_KEY` is a secret of the edge function, set in Supabase, never exposed to the client.

## Release

- A release is a push to `main`. Rollback is Vercel's "promote a previous deployment"; a database migration has no rollback path and must be undone by hand.

## Monitoring

- None. No error tracking, no alerting, no log aggregation beyond Vercel's and Supabase's own dashboards.
