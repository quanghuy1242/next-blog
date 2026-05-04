# Session Summary: Auth R3 Complete

> Date: 2026-05-04
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

Completed Release R3:

- `R3-A1` through `R3-A3` in `auther`
- `R3-P1` through `R3-P3` in `payloadcms`
- `R3-B1` in `next-blog`

R3 moves Payload projection routing to authorization-space metadata while keeping the legacy client-based path available as rollback compatibility.

---

## 2. Auther R3

Implemented:

- `access_tuples.authorizationSpaceId` with migration and backfill from `authorization_models.authorizationSpaceId`
- tuple creation now resolves and persists the model authorization space
- `grant.created`, `grant.revoked`, and `grant.condition.updated` payloads include `authorizationSpaceId`
- legacy webhook `clientId` payload metadata remains for compatibility
- new internal space-scoped routes:
  - `/api/internal/authorization-spaces/:spaceId/grants`
  - `/api/internal/authorization-spaces/:spaceId/list-objects`
- API keys may consume space routes only when their OAuth client is linked to the space with `full` access
- old `/api/internal/clients/:clientId/grants` and `/api/auth/list-objects` routes remain intact

---

## 3. Payload R3

Implemented:

- `AUTHER_USE_SPACE_ROUTING=true|false`
- webhook routing now prefers `authorizationSpaceId` when present and space routing is enabled
- webhook routing falls back to legacy `clientId` when space metadata is absent or the flag is disabled
- reconcile grant sweep can use the space-scoped grants API
- list-objects calls can use the space-scoped list-objects API
- explicit logs identify whether client routing or authorization-space routing was used
- `.env.example` documents `AUTHER_USE_SPACE_ROUTING`

Compatibility remains:

- `AUTHER_CLIENT_ID` / Payload client routing still work when `AUTHER_USE_SPACE_ROUTING=false`
- client-prefixed entity type names such as `client_payload:book` are still accepted during the transition

---

## 4. Next-Blog R3

No behavioral change was required.

The blog R1/R2 auth flow remains stable and continues forwarding the existing bearer token to Payload.

---

## 5. R3 Exit Criteria Check

1. Payload projection routing uses `authorizationSpaceId`: pass.
2. Payload no longer depends on `PAYLOAD_CLIENT_ID` as the primary grant mirror ownership router when `AUTHER_USE_SPACE_ROUTING=true`: pass.
3. Old client-based compatibility paths still exist but are no longer primary under the flag: pass.

There is no remaining R3 implementation work left in this release.

---

## 6. Verification

Ran in `/home/quanghuy1242/pjs/auther`:

- `pnpm exec tsc --noEmit`
- `pnpm exec tsx --test tests/tuple-repository.grant-webhook-gating.test.ts tests/registration-context-grants.test.ts`
- `pnpm run lint`
- `BLOG_CLIENT_ID=blog-local BLOG_REDIRECT_URI=http://localhost:3000/auth/callback pnpm build`

Ran in `/home/quanghuy1242/pjs/payloadcms`:

- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run --config ./vitest.config.mts tests/int/grant-mirror.int.spec.ts tests/int/auther-webhook-route.int.spec.ts tests/int/reconcile-route.int.spec.ts tests/int/auther-env.int.spec.ts`
- `pnpm exec vitest run --config ./vitest.config.mts tests/int/chapter-edit-access-notice.int.spec.tsx`
- `pnpm exec vitest run --config ./vitest.config.mts --exclude tests/int/api.int.spec.ts`
- `pnpm run lint`
- `pnpm build`

Payload `pnpm run test:int` was also attempted. After fixing a local test cleanup issue, the only remaining full-suite blocker was `tests/int/api.int.spec.ts`, which pulls schema from the configured Turso URL and failed with `ECONNRESET` before running assertions. The local integration suite passes when that network-backed test is excluded.

Ran in `/home/quanghuy1242/pjs/next-blog`:

- `pnpm run lint`
- `pnpm test`
- `pnpm build`

Payload lint/build still emit pre-existing warnings unrelated to R3.
