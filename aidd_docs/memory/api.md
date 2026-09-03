# API

## Style

- The project exposes no API of its own. The client talks to Supabase's generated REST surface through `supabase-js`.
- The one piece of server code is a Supabase Edge Function (Deno) at `supabase/functions/comicvine-search/`: a `GET ?q=<query>` proxy that exists only because Comic Vine sends no CORS headers.

## Contracts

- The edge function forwards Comic Vine's JSON body and status unchanged, adding permissive CORS headers, and answers `OPTIONS` preflight. It fails with `400` on a missing `q` and `500` when `COMICVINE_API_KEY` is not set in the function's environment.
- Everything else is Supabase's own contract — see the Supabase docs, not a spec in this repo.
