# Session Summary: Auth R4 UI-Managed OAuth Clients

> Date: 2026-05-05
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/next-blog`
>
> Baseline:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/states/2026-05-05-auth-r4-cleanup-review.md`

## 1. Review Scope

Reviewed whether the R4 admin surfaces are enough to manage new OAuth clients, resource servers, authorization spaces, model ownership, and grants without making Auther code or env changes for each new object.

## 2. Finding

Auther still had stale pre-R4 behavior in `src/lib/auth.ts`: Payload Admin, Payload SPA, and Next Blog were defined as env-backed Better Auth `trustedClients`. That meant adding or changing OAuth clients could still require changing env values and redeploying Auther.

The UI-created OAuth clients also stored `oauthApplication.redirectURLs` as a JSON array string. Better Auth's OIDC provider reads database client redirects as comma-separated text, so database-managed clients could fail redirect validation once the hardcoded `trustedClients` fallback was removed.

## 3. Auther Changes

Removed the hardcoded OAuth client list from `src/lib/auth.ts`. Better Auth now resolves OAuth clients from the `oauthApplication` database table, which is managed by the admin UI.

Changed OAuth client create/update flows and test seeding to store redirect URIs in Better Auth's comma-separated format:

- `src/app/admin/clients/register/actions.ts`
- `src/app/admin/clients/[id]/actions.ts`
- `scripts/seed-oauth-clients-for-tests.ts`
- `src/lib/client-utils.ts`

Added runtime compatibility for existing rows:

- `src/lib/utils/oauth-client.ts`
- `src/lib/auth.ts`

On authorize requests, Auther now normalizes the target client's redirect storage before Better Auth validates the client. Preview redirects can still be appended for matching preview origins.

Added database-aware CORS handling for auth endpoints:

- `src/app/api/auth/[...betterAuth]/route.ts`

Registered OAuth client redirect/logout origins can now receive CORS headers without adding each origin to `trustedOrigins` in code. `AUTH_TRUSTED_ORIGINS` remains an operational escape hatch for non-client origins.

Separated internal signup protection from Payload's OAuth client secret:

- `src/env.ts`
- `.env.example`
- `scripts/create-user.ts`
- `scripts/seed-admin-user.ts`
- `scripts/seed-clients.ts`

`INTERNAL_SIGNUP_SECRET` is now the intended guard secret. `PAYLOAD_CLIENT_SECRET` remains accepted as a fallback for older local environments and legacy scripts.

Updated `docs/payload-better-auth-integration.md` so it no longer tells future work to add `trustedClients` in code or redeploy Auther for OAuth client changes.

## 4. Operational Boundary

Auther no longer needs a redeploy for:

- new OAuth clients
- redirect URI changes
- logout URI changes
- resource servers
- authorization spaces
- client-to-space links
- model ownership
- space grants

Consuming apps still need to know their own `client_id`, and confidential clients still need their `client_secret`. Unless those apps also gain dynamic config, changing those values still requires updating the consuming app's configuration. That is outside Auther's runtime-management boundary.

## 5. Verification

Ran in `/home/quanghuy1242/pjs/auther`:

- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm exec tsx --test tests/*.test.ts`
- `pnpm run build`

All passed. The production build still prints the existing `baseline-browser-mapping` freshness warning.
