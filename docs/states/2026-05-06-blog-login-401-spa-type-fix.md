# Session Summary: Blog Login 401 — Invalid OAuth Client Type

> Date: 2026-05-06
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/payloadcms`

## 1. Symptom

Blog login via auther returned 401 on `POST /api/auth/oauth2/token`. No application-level log was emitted. Payload admin login continued to work.

## 2. Root Cause

The blog OAuth client in the live `oauth_application` table had `type: 'spa'`:

```sql
client_id: client_4cce66837b080ce390b7b41cf1abcc0e
type: spa   ← invalid better-auth client type
```

Better Auth's OIDC provider only accepts the client types:

- `web`
- `native`
- `public`
- `user-agent-based`

Before R4, the blog client was defined as a static `trustedClients` entry in `src/lib/auth.ts` with `type: 'public'`. Better Auth's `getClient()` checked the `trustedClients` list first and never read the DB `type` field. The R4 UI-managed OAuth clients change removed `trustedClients`, so Better Auth fell through to the DB entry and saw the unrecognized `type: 'spa'`. The token endpoint then rejected the PKCE public-client flow as unclassifiable → 401.

## 3. Fixes

### Auther — DB row correction

The live blog client row was updated:

```sql
UPDATE oauth_application SET type = 'public'
WHERE client_id = 'client_4cce66837b080ce390b7b41cf1abcc0e';
```

### Auther — Client creation UI corrected

Prevented future creation of clients with invalid `type` values:

- `src/lib/oauth-constants.ts` — changed `CLIENT_TYPES` from `["web", "spa", "native"]` to `["web", "public", "native"]` and updated `APPLICATION_TYPE_OPTIONS` dropdown label accordingly.
- `src/schemas/clients.ts` — changed `registerClientSchema.type` Zod enum from `["web", "spa", "native"]` to `["web", "public", "native"]`.

### Payload — Removed cross-site CORS/CSRF for blog

Payload's `buildConfig` had explicit CORS and CSRF origins for `https://blog.quanghuy.dev` to support cross-site token usage. Since cross-site tokens are no longer desired, both lines were removed:

- `src/payload.config.ts` — removed `cors: ['https://blog.quanghuy.dev']` and `csrf: ['https://blog.quanghuy.dev']`.

## 4. Verification

Ran in `/home/quanghuy1242/pjs/auther`:

- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm run build`

Ran in `/home/quanghuy1242/pjs/payloadcms`:

- `pnpm exec tsc --noEmit`
- `pnpm run lint`

All passed. Blog login confirmed working after the DB type fix.
