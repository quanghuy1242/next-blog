# Auth Access Client Elimination Completion

> Date: 2026-05-06
>
> Repo implemented: `/home/quanghuy1242/pjs/auther`
>
> Supersedes: `docs/states/2026-05-06-auth-correction-phase-3-6-implementation-review.md`

---

## Summary

Closed the remaining auth-space access-control gaps that were still client-centric.

The active access-control path is now authorization-space native:

- auth-space service accounts can be created, listed, rotated, and revoked without exposing or requiring an OAuth client owner
- internal grants moved to `/api/internal/authorization-spaces/{spaceId}/grants`
- old `/api/internal/clients/{clientId}/grants` routes now return `410 Gone`
- API-key runtime exchange/check/list paths require `authorization_space_id` metadata
- authorization-space `full_access` is evaluated from the canonical model's `authorizationSpaceId`, not from `client_<id>` entity names
- registration-context pending application is durable-only; the in-memory fallback is removed
- permission requests now include an authorization-space resource request creation flow
- the Payload R2 seed path now points at canonical `space_<spaceId>:<model>` model names

---

## Closed Items

### 1. Space-Native Service Accounts

Implemented:

- `src/lib/auth/authorization-space-service-account-service.ts`
- `src/app/admin/authorization-spaces/[id]/access/service-accounts-panel.tsx`
- service-account create/rotate/revoke actions in `src/app/admin/authorization-spaces/[id]/access/actions.ts`

Behavior:

- Better Auth API-key storage remains the backing primitive, but new keys are scoped with:
  - `metadata.authorization_space_id`
  - `metadata.access_model = "authorization_space"`
- no `oauth_client_id` or `backing_client_id` metadata is written
- full-access service accounts receive:
  - `entityType = authorization_space`
  - `entityId = <spaceId>`
  - `relation = full_access`
  - `authorizationSpaceId = <spaceId>`
- scoped service accounts receive model-id-backed tuples in the selected authorization space
- rotation creates a new space-native key with equivalent grants, then revokes the old key and deletes its tuples
- revoke deletes the Better Auth key and all `apikey:<keyId>` tuples

### 2. Model Rename Migration

Code support is ready:

- alias table/helper already exists
- `scripts/migrate-space-model-identities.ts` handles dry-run and `--apply`
- `scripts/seed-r2-payload-space.ts` no longer targets `client_<clientId>:<model>` names

Operational requirement:

- the data migration must be applied against the real target database during deployment
- local execution was attempted but the local libSQL endpoint was not running at `127.0.0.1:8080`
- this is not a code gap; it is the deployment step that mutates real data

Required deployment command after DB connectivity is available:

```bash
pnpm exec tsx scripts/audit-authorization-space-access.ts
pnpm exec tsx scripts/migrate-space-model-identities.ts
pnpm exec tsx scripts/migrate-space-model-identities.ts --apply
pnpm exec tsx scripts/audit-authorization-space-access.ts
```

### 3. Runtime Canonical Identity Verification

Updated:

- `src/app/api/auth/api-key/exchange/route.ts`
- `src/app/api/auth/check-permission/route.ts`
- `src/app/api/auth/list-objects/route.ts`
- `src/lib/auth/permission-service.ts`
- `src/lib/auth/space-api-key-auth.ts`

Behavior:

- runtime API-key access requires `authorization_space_id`
- client-scoped API keys are rejected by space-native routes
- check/list endpoints validate requested entity types against the key's authorization space
- JWT exchange emits `authorization_space_full_access`
- JWT exchange no longer emits `client_full_access`
- permission-service full-access bypass no longer parses client-prefixed entity names

### 4. Durable Registration Context Pending Queue

Updated:

- `src/lib/pipelines/registration-grants.ts`
- `src/lib/pipelines/index.ts`
- `tests/registration-grants.metrics.test.ts`

Behavior:

- `pendingContextGrants` in-memory map was removed
- `queueContextGrant` compatibility export was removed
- `applyClientContextGrants` compatibility export was removed
- pending context application now reads from the durable pending application repository only

### 5. Old Client Access Actions And Internal Routes

Active route behavior:

- `/admin/clients/[id]/access` redirects to the linked authorization-space access page or client spaces page
- `/api/internal/clients/{clientId}/grants` returns `410 Gone`
- `/api/internal/clients/{clientId}/grants/{tupleId}` returns `410 Gone`

Removed dead helpers:

- `src/lib/auth/client-api-key-auth.ts`
- `src/lib/auth/authorization-space-access-client.ts`

The remaining OAuth-client admin pages are for OAuth application/channel management, not auth-space access ownership.

### 6. Space-Native Internal Grants API

Added:

- `src/app/api/internal/authorization-spaces/[spaceId]/grants/route.ts`
- `src/app/api/internal/authorization-spaces/[spaceId]/grants/[tupleId]/route.ts`

Behavior:

- `GET` lists grants by `authorizationSpaceId`
- optional `entityTypeName + entityId` filtering resolves the model inside that space
- unknown filter models return `404`, not a broad grant listing
- `POST` creates grants by `modelId` or `entityTypeName`
- `DELETE` deletes only tuples inside the requested authorization space

### 7. Authorization-Space Permission Request UI

Updated:

- `src/app/admin/requests/actions.ts`
- `src/app/admin/requests/page.tsx`
- `src/app/admin/requests/requests-client.tsx`

Behavior:

- request UI now has a New Request tab for authorization-space resource grants
- admins can choose user, authorization-space model/relation target, resource id, and reason
- approval writes a tuple scoped to `authorizationSpaceId`
- OAuth-client login request approval still uses `oauth_client_login`, not client-prefixed resource grants

---

## Deployment Notes

Required environment:

```bash
AUTH_ACCESS_LEGACY_WRITE_MODE=block
INVITE_HMAC_SECRET=<long-random-secret>
```

Deploy sequence:

```bash
pnpm run db:push
pnpm exec tsx scripts/audit-platform-registration-access.ts
pnpm exec tsx scripts/audit-authorization-space-access.ts
pnpm exec tsx scripts/migrate-space-model-identities.ts
pnpm exec tsx scripts/migrate-space-model-identities.ts --apply
pnpm exec tsx scripts/audit-authorization-space-access.ts
pnpm run auth:r2:seed-payload-space
```

Consumer changes:

- replace `/api/internal/clients/{clientId}/grants` with `/api/internal/authorization-spaces/{spaceId}/grants`
- rotate/recreate existing service-account API keys from the auth-space Service Accounts panel so they carry `authorization_space_id`
- consuming services should read `authorization_space_full_access`, not `client_full_access`

---

## Verification

Ran in `/home/quanghuy1242/pjs/auther`:

```text
pnpm exec tsc --noEmit
pnpm run lint
pnpm build
pnpm exec tsx --test tests/permission-service.full-access-fast-path.test.ts tests/registration-grants.metrics.test.ts
pnpm exec tsx scripts/audit-authorization-space-access.ts
pnpm exec tsx scripts/migrate-space-model-identities.ts
```

Results:

- typecheck passed
- lint passed
- production build passed
- focused tests passed: 5/5
- audit dry-run and migration dry-run could not run because local libSQL was not reachable at `127.0.0.1:8080`

The blocked audit/migration commands are listed in the deployment sequence above and must be run where the database endpoint is available.
