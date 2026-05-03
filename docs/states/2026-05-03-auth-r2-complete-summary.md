# Session Summary: Auth R2 Complete

> Date: 2026-05-03
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/payloadcms`
> - `/home/quanghuy1242/pjs/next-blog`
>
> Planning source:
>
> - `docs/auth-migration-backlog.md`
> - `docs/auth-architecture-correction-plan.md`

---

## 1. Scope Completed

Completed all remaining Release R2 tasks:

- `R2-A1` through `R2-A6` in `auther`
- `R2-P1` and `R2-P2` in `payloadcms`
- `R2-B1` in `next-blog`

R2 remains additive. It does not move Payload projection routing from client-based to space-based. That switch belongs to R3.

---

## 2. Payload R2

### R2-P1 Space-Aware Config Support

Added optional Payload config accessors:

- `getAutherAuthorizationSpaceId`
- `getAutherAuthorizationSpaceSlug`

Added env examples:

- `AUTHER_AUTHORIZATION_SPACE_ID`
- `AUTHER_AUTHORIZATION_SPACE_SLUG`

These values are not primary routing filters in R2.

### R2-P2 Dual Metadata Support

Payload webhook/projection parsing now accepts future `authorizationSpaceId` metadata alongside existing `clientId` metadata.

Current behavior is preserved:

- `clientId` remains the source-of-truth webhook filter
- events for the wrong client are still skipped
- `authorizationSpaceId` is accepted but not used to route projection yet

---

## 3. Next-Blog R2

### R2-B1 No Major Flow Change

The blog-owned R1 auth flow was left unchanged.

Only env examples were updated to document the existing R1 Auther variables:

- `AUTH_BASE_URL`
- `BLOG_CLIENT_ID`
- `BLOG_REDIRECT_URI`
- `BLOG_POST_LOGOUT_REDIRECT_URI`

No auth routing, token extraction, or Payload forwarding behavior was reworked.

---

## 4. R2 Exit Criteria Check

### 1. Authorization space and resource server exist as first-class concepts in `auther`

Pass.

Implemented as separate tables and repositories:

- `authorization_spaces`
- `resource_servers`

They were not modeled as OAuth client types.

### 2. OAuth client model remains unchanged

Pass.

Existing OAuth clients still live in `oauth_application`. Client type semantics were not repurposed.

### 3. Authorization models can be linked to spaces

Pass.

`authorization_models.authorizationSpaceId` is present and nullable for R2 transition compatibility. Admin UI can assign model ownership to a space.

### 4. Clients can be linked to spaces

Pass.

`oauth_client_space_links` links OAuth clients to spaces with:

- `login_only`
- `can_trigger_contexts`
- `full`

Client detail UI has a `Spaces` tab for link management.

A follow-up review fixed the link table to enforce uniqueness for `(clientId, authorizationSpaceId)` and added a compatibility migration for databases that already applied the first R2 migration.

### 5. System still behaves compatibly with current production routing

Pass.

Compatibility preserved:

- `auther` still keeps R1 projection allowlist as migration metadata
- unbackfilled authorization models still use the R1 client/projection validation path
- Payload webhook routing remains client-based
- Payload reconcile and grant mirror still use the configured Payload client id
- next-blog auth flow remains unchanged

Auther also includes `pnpm auth:r2:seed-payload-space` to create/link/backfill the Payload content space when `PAYLOAD_CLIENT_ID` and `BLOG_CLIENT_ID` are configured.

---

## 5. Verification

Ran in `/home/quanghuy1242/pjs/auther`:

- `pnpm exec tsx --test tests/registration-context-grants.test.ts`
- `BLOG_CLIENT_ID=blog-local BLOG_REDIRECT_URI=http://localhost:3000/auth/callback pnpm build`

Ran in `/home/quanghuy1242/pjs/payloadcms`:

- `pnpm exec vitest run --config ./vitest.config.mts tests/int/auther-env.int.spec.ts tests/int/grant-mirror.int.spec.ts tests/int/auther-webhook-route.int.spec.ts`
- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm build`

Ran in `/home/quanghuy1242/pjs/next-blog`:

- `pnpm exec vitest run tests/pages/auth-routes.test.ts`
- `pnpm run lint`
- `pnpm build`

All commands completed successfully. Payload lint/build still emit pre-existing warnings unrelated to R2.

---

## 6. Remaining Work

R2 is complete.

Next planned migration release is R3:

- add `authorizationSpaceId` to Auther grant event payloads
- move Payload projection routing from `clientId` to authorization space
- keep rollback compatibility while the consumer switches over
