# Auth Correction Phase 3-6 Implementation And Review

> Date: 2026-05-06
>
> Repo implemented: `/home/quanghuy1242/pjs/auther`
>
> Status update: Superseded by `docs/states/2026-05-06-auth-access-client-elimination-completion.md`, which closes the remaining gaps listed in this log.
>
> Planning docs:
>
> - `docs/auth-correction-execution-order.md`
> - `docs/auth-space-access-control-implementation-plan.md`
> - `docs/auth-platform-registration-access-correction-plan.md`

---

## Summary

Implemented the next correction slice across phase 3, phase 4, phase 5, and phase 6.

This pass focused on removing remaining active client-centric behavior from runtime and admin entry points:

- auth-space access page no longer embeds the old client `AccessControl`
- auth-space access page no longer imports old client access actions
- invite creation now uses the signed invite format expected by verification
- invite/open-context verification now queues durable pending context applications
- OAuth authorize no longer applies registration context grants as a side effect
- client-created registration contexts now write explicit trigger/target fields instead of `clientId` ownership
- permission request approval now writes `oauth_client_login` grants for OAuth-client login eligibility instead of `client_<clientId>` grants

---

## Phase 3: Model Normalization Follow-Through

Already implemented in the previous slice:

- `authorization_model_aliases`
- `AuthorizationModelRepository` alias helpers
- `scripts/migrate-space-model-identities.ts`

This pass kept the runtime/UI moving toward that model by removing old auth-space imports that depended on client-prefixed model ownership.

Not yet run:

- `scripts/migrate-space-model-identities.ts --apply`

Reason:

- this should be run only after audit output is reviewed against staging/production data
- Payload/webhook consumers still need final confirmation before canonical model rename is applied broadly

---

## Phase 4: Auth-Space Access UI

Changed:

- `/admin/authorization-spaces/[id]/access/page.tsx`

Removed from the page:

- old `AccessControl` component
- old `ClientProvider`
- old client access action imports
- canonical backing client display as the organizing model

Current page sections:

- `Model Ownership`
- `Space Grants`
- `Service Accounts`
- `Linked Clients`

Important behavior:

- service accounts are displayed from space-scoped tuples where `subjectType = apikey`
- linked clients are displayed as integration/login channels
- OAuth clients are no longer shown as access owners for the space
- platform access is not present on the auth-space page

Superseded follow-up:

- service-account creation/rotation was rebuilt as a space-native flow in `docs/states/2026-05-06-auth-access-client-elimination-completion.md`

---

## Phase 5: Registration Contexts, Invites, And Requests

Changed:

- `src/lib/pipelines/registration-grants.ts`
- `src/app/api/auth/verify-invite/route.ts`
- `src/lib/middleware/origin-validation.ts`
- `src/app/admin/users/invites-actions.ts`
- `src/app/admin/clients/[id]/registration-actions.ts`
- `src/app/admin/requests/actions.ts`
- `src/lib/services/permission-request-service.ts`
- `src/lib/repositories/platform-access-repository.ts`

Registration context application:

- added `queueContextGrantDurable`
- verification routes now queue durable pending applications
- durable rows are applied after user creation
- durable rows are marked `applied` or `failed`
- in-memory queue remains only as a same-process rollout fallback

Invite unification:

- admin invite creation now calls `registrationContextService.createSignedInvite`
- invite creation and `/api/auth/verify-invite` now agree on signed-token format
- invite URLs now use `/sign-up?invite=<signed-token>`

OAuth authorize mutation:

- removed default call to `applyClientContextGrants` from OAuth authorize hook
- registration context grants now come from explicit registration/invite/origin triggers

Client registration context writes:

- new client context writes use:
  - `clientId: null`
  - `triggerKind: oauth_client`
  - `triggerClientId: <clientId>`
  - `targetKind: authorization_space`
  - `targetId: <spaceId>` when unambiguous, otherwise `*`

Permission request approval:

- OAuth-client login request approvals now write:
  - `entityType = oauth_client_login`
  - `entityId = <clientId>`
- platform approvals continue to write platform tuples
- `client_<clientId>` request grants are no longer created by these paths

---

## Phase 6: Compatibility Removal

Removed from active/default runtime:

- auth-space import of old client access-control surface
- authorize-time registration grant mutation
- mismatched random-token invite creation
- client-prefixed permission request approval grants

Superseded compatibility notes:

- the compatibility items from this earlier pass were closed in `docs/states/2026-05-06-auth-access-client-elimination-completion.md`

---

## Review Against Definition Of Done

This review section is superseded by `docs/states/2026-05-06-auth-access-client-elimination-completion.md`.

### Done Or Mostly Done

- auth-space page no longer imports old client `AccessControl`
- auth-space page no longer has `Platform Access`
- platform access is separated from OAuth-client login eligibility
- invite creation and verification now use one signed token format
- OAuth authorize no longer silently applies context grants
- permission requests no longer create `client_<clientId>` grants for OAuth-client login requests
- durable pending registration context table is now used by invite/origin verification flows
- linked clients are displayed as channels, not owners

### Superseded Gap List

The gap list from this earlier review was closed in the follow-up implementation pass documented in `docs/states/2026-05-06-auth-access-client-elimination-completion.md`.

---

## Verification

Ran in `/home/quanghuy1242/pjs/auther`:

```text
pnpm run lint
node --import tsx --test tests/registration-grants.metrics.test.ts tests/registration-context-grants.test.ts tests/permission-service.full-access-fast-path.test.ts tests/client-api-key-actions.full-access.test.ts tests/api-key-permission-resolver.client-full-access.test.ts
git diff --check
```

Results:

- lint passed
- typecheck passed
- focused tests passed: 27/27
- diff check passed

---

## Deployment Notes

### Required Environment

Set these before deploy:

```text
INVITE_HMAC_SECRET=<long random secret>
AUTH_ACCESS_LEGACY_WRITE_MODE=block
```

`AUTH_ACCESS_LEGACY_WRITE_MODE` values:

- `block`: default and recommended for normal deploys
- `audit`: logs legacy writes but allows them; useful only during migration diagnosis
- `allow`: permits legacy writes; avoid except emergency rollback/debug

### Deploy Order

1. Deploy code with `AUTH_ACCESS_LEGACY_WRITE_MODE=audit` only if you expect old admin paths to still be used during the first smoke test.
2. Apply database migration:

```text
pnpm run db:push
```

or apply `drizzle/0022_auth_access_correction_foundations.sql` through the normal migration pipeline.

3. Run audits:

```text
node --import tsx scripts/audit-authorization-space-access.ts
node --import tsx scripts/audit-platform-registration-access.ts
```

4. Smoke test:

- create signed invite from admin users page
- verify invite through `/api/auth/verify-invite`
- create a user through invite flow and confirm pending context application is marked applied
- open `/admin/authorization-spaces/<id>/access`
- create/revoke a space grant
- confirm no platform access tab appears in auth-space access
- confirm OAuth authorize does not create new context grants

5. Switch or keep:

```text
AUTH_ACCESS_LEGACY_WRITE_MODE=block
```

6. Run model migration dry-run:

```text
node --import tsx scripts/migrate-space-model-identities.ts
```

7. Only after audit review and integration confirmation, run:

```text
node --import tsx scripts/migrate-space-model-identities.ts --apply
```

### Rollback Notes

- Do not remove the new columns/tables during rollback.
- If a legacy admin path is unexpectedly needed, temporarily set:

```text
AUTH_ACCESS_LEGACY_WRITE_MODE=audit
```

- Do not use `allow` unless you intentionally want to create more stale legacy data.
- Existing legacy reads continue to work.
- Alias rows preserve lookup compatibility after model identity migration.

---

## Superseded Next Ticket

The recommended next ticket from this earlier log was implemented in `docs/states/2026-05-06-auth-access-client-elimination-completion.md`.
