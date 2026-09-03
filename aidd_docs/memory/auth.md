# Auth

## Authentication

- Supabase Auth, email-based: magic link and password, with a password-recovery flow. Wired in `src/lib/auth.ts`, which exposes `session`, `authLoading` and `passwordRecovery` stores.
- `authLoading` exists so the app renders a loading state instead of flashing the login screen while the session is restored.

## Authorization

- Enforced in Postgres, not in the client. Every table has RLS on with `auth.uid() = user_id` policies for select/insert/update/delete, and `user_id` defaults to `auth.uid()` — so the client never sets it.
- Cover uploads are scoped by folder: the `covers` bucket is publicly readable, but a user may only write under a path whose first segment is their own uid.
- There are no roles or scopes. Every authenticated user sees exactly their own rows.

## Sessions

- Handled entirely by `supabase-js` (storage, refresh, expiry). `onAuthStateChange` keeps the store in sync. Nothing about the session is managed by our code.
