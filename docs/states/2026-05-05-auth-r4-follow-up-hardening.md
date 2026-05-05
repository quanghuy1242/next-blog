# Session Summary: Auth R4 Follow-Up Hardening

> Date: 2026-05-05
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/payloadcms`
>
> Baseline:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/auth-migration-backlog.md`
> - `docs/states/2026-05-05-auth-r4-token-contract.md`

## 1. Why This Follow-Up Happened

After R4 was deployed, `/api/auth/oauth2/token` failed in Auther with:

```text
hex string expected, got non-hex character ""2" at index 0
```

The cause was the new resource access-token signing path assuming one JWKS private-key storage shape.

Better Auth stores its generated JWKS private key as a JSON-encoded encrypted string, while existing API-key exchange tests used a raw encrypted string. The R4 signer needed to support both.

## 2. Auther Fixes

Updated:

- `/home/quanghuy1242/pjs/auther/src/lib/auth/resource-access-token.ts`

Fixes:

- resource access-token signing now handles both Better Auth JSON-encoded encrypted JWKS values and raw encrypted private-key strings
- the Payload resource-token topology is configurable instead of hidden as non-overridable code constants

Added optional envs:

```env
PAYLOAD_RESOURCE_TOKEN_SPACE_SLUG=payload-content
PAYLOAD_RESOURCE_TOKEN_RESOURCE_SERVER_SLUG=payload-content-api
```

The token `aud` still comes from the `resource_servers.audience` database row. These envs only select which configured authorization space and resource-server slug should be used for the current Payload resource-token bridge.

## 3. Payload Fixes

Updated:

- `/home/quanghuy1242/pjs/payloadcms/src/lib/betterAuth/env.ts`
- `/home/quanghuy1242/pjs/payloadcms/tests/int/better-auth-env.int.spec.ts`
- `/home/quanghuy1242/pjs/payloadcms/docs/payload-better-auth-integration.md`

Fixes:

- `PAYLOAD_ACCEPT_CLIENT_AUDIENCES=false` now truly disables client-audience acceptance even if stale client IDs remain in `BETTER_AUTH_JWT_AUDIENCE`
- known client ids are included only when `PAYLOAD_ACCEPT_CLIENT_AUDIENCES=true`
- docs now describe `PAYLOAD_RESOURCE_SERVER_AUDIENCE` as the Payload validation audience

## 4. Verification

Ran in `/home/quanghuy1242/pjs/auther`:

- `pnpm exec tsc --noEmit`
- `BLOG_CLIENT_ID=blog-local BLOG_REDIRECT_URI=http://localhost:3000/auth/callback pnpm build`
- `BLOG_CLIENT_ID=blog-local BLOG_REDIRECT_URI=http://localhost:3000/auth/callback pnpm exec tsx --test tests/full-access.integration.test.ts`

Ran in `/home/quanghuy1242/pjs/payloadcms`:

- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run --config ./vitest.config.mts tests/int/better-auth-env.int.spec.ts`

All passed.

Auther build still emits the pre-existing `baseline-browser-mapping` freshness warning.

## 5. Remaining Caveat

R4 resource selection is still implicit for the current product topology:

- clients linked to the configured Payload authorization space get a Payload resource access token

That matches the current R4 plan and deployed product shape.

If the system later supports multiple resource servers per OAuth client, the next clean step is explicit OAuth resource selection, such as a `resource` parameter or another first-class request field.

