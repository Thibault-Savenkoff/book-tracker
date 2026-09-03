# Codebase Audit: security

Auth redirect configuration is the real risk; the application code itself is clean.

- **Date**: 2026-09-03
- **Scope**: security
- **Health**: fair
- **Findings**: 1 critical, 3 warning, 2 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🔴 | security | `supabase/config.toml:158` | `additional_redirect_urls` contains the wildcard `https://*.vercel.app`. Supabase matches it against any subdomain, so a magic-link or password-reset code can be redirected to a Vercel app owned by anyone and exchanged for a session. Classic auth-code leak via open redirect. | Replace the wildcard with the exact production URL(s). Add preview deployments explicitly if needed. | S |
| 🟡 | security | `supabase/functions/comicvine-search/index.ts:3` | `Access-Control-Allow-Origin: '*'` with no caller check, and the client calls it with no `Authorization` header (`src/lib/bookLookup.ts:431`). The function is an open relay carrying `COMICVINE_API_KEY`: anyone can drain the quota. | Restrict CORS to the app origin, and require the Supabase JWT (`verify_jwt`) since only signed-in users search. | S |
| 🟡 | security | `supabase/config.toml:186` | `enable_signup = true` with no captcha on a single-user personal app. Strangers can create accounts. RLS keeps their data separate, so this is abuse/quota, not exposure. | Disable signup once your account exists, or enable `[auth.captcha]`. | S |
| 🟡 | security | `supabase/config.toml:150` | `site_url` points at a Tailscale host (`macbook-air-de-anas.taildc31ca.ts.net`). Auth emails build links from it, so a password reset sent to a phone off the tailnet lands on an unreachable URL. | Set `site_url` to the Vercel production URL. | S |
| 🟢 | security | `supabase/config.toml:194` | `minimum_password_length = 6` and `password_requirements = ""` — the weakest setting Supabase allows. | Raise to 8+ and set `lower_upper_letters_digits`. | S |
| 🟢 | security | `src/lib/supabase.ts:6` | `createClient(url, anonKey)` with no guard on missing env vars. A bad deploy fails with an opaque client error instead of a clear one. | Throw a named error when either var is absent. | S |

Scope caveat: `supabase/config.toml` is the Supabase CLI's declaration of project settings. The live cloud project may have been changed through the dashboard. Verify each config finding there before concluding it is live.

## Top actions

1. Remove the `*.vercel.app` wildcard from `additional_redirect_urls` — resolves the one critical row.
2. Lock down the Comic Vine relay (CORS origin + JWT) and turn off open signup.
3. Point `site_url` at production so auth emails work off-tailnet.

## Coverage

- **Scanned**: security — input validation, authn/authz gates, secrets, injection, deserialization, insecure defaults. No `{@html}`, `eval`, or `innerHTML` anywhere in `src/`. No hardcoded credentials; `.env` is git-ignored and only `.env.example` is committed. RLS policies are consistent across `books`, `quotes`, and the `covers` bucket, and `user_id` defaults to `auth.uid()`.
- **Skipped**: no SAST tool installed, static inspection only. Live cloud auth settings not verified (no dashboard access).
