# Auth Correction Phase 0-3 Non-UI Implementation Status

> Date: 2026-05-06
>
> Repo implemented: `/home/quanghuy1242/pjs/auther`
>
> Planning docs:
>
> - `docs/auth-correction-execution-order.md`
> - `docs/auth-space-access-control-implementation-plan.md`
> - `docs/auth-platform-registration-access-correction-plan.md`

---

## Summary

Started implementation for phase 0 through phase 3 non-UI work.

This pass intentionally did not rebuild the admin tabs. It focused on the foundation needed before UI work:

- audit scripts
- migration schema
- legacy write guards
- explicit target/trigger fields
- platform/system access service
- authorization model aliasing
- space model identity migration helper

---

## Phase 0: Audit And Freeze

Implemented in `auther`:

- `scripts/audit-authorization-space-access.ts`
- `scripts/audit-platform-registration-access.ts`
- `src/lib/auth/legacy-write-guard.ts`

Legacy write guard behavior:

- default mode is `block`
- `AUTH_ACCESS_LEGACY_WRITE_MODE=audit` logs but allows
- `AUTH_ACCESS_LEGACY_WRITE_MODE=allow` allows without blocking

Blocked/frozen paths:

- new `oauth_client owner/admin/use` tuple writes through tuple repository create/replace paths
- new client-prefixed authorization model writes through authorization model repository upsert/rename paths
- old registration context/request/rule repository writes when they do not provide explicit target/trigger fields

Notes:

- existing legacy reads are still supported
- old UI paths that still attempt legacy writes will now fail closed unless the migration env override is used
- this is intentional for phase 0 because the goal is to stop stale data from expanding

---

## Phase 1: Target Schema And Compatibility Adapters

Implemented schema:

- `src/db/rebac-schema.ts`
  - added `authorization_model_aliases`
- `src/db/platform-access-schema.ts`
  - added explicit registration context trigger/target columns
  - added explicit permission request target columns
  - added explicit permission rule trigger/target columns
  - added `pending_registration_context_applications`
- `drizzle/0022_auth_access_correction_foundations.sql`
- `drizzle/meta/_journal.json`

Implemented repository adapters:

- `AuthorizationModelRepository.findByEntityTypeOrAlias`
- `AuthorizationModelRepository.findActiveAlias`
- `AuthorizationModelRepository.findActiveAliasesForModel`
- `AuthorizationModelRepository.createAlias`
- `AuthorizationModelRepository.retireAlias`
- `AuthorizationModelRepository.upsertForAuthorizationSpace`
- targeted create methods for registration contexts, permission requests, and permission rules
- pending registration context application repository

Notes:

- Better Auth API-key backing-client behavior was not changed in this pass
- compatibility is explicit through alias rows instead of implicit client-prefix ownership

---

## Phase 2: Migrate Platform Access First

Implemented:

- `src/lib/auth/platform-access-service.ts`
- expanded `SYSTEM_MODELS` with:
  - `authorization_spaces`
  - `registration_contexts`
  - `permission_requests`
  - `policy_templates`
  - `oauth_client_login`

Platform access direction after this pass:

- global platform access writes should go through `PlatformAccessService`
- legacy `oauth_client owner/admin/use` writes are blocked at the tuple repository layer
- legacy tuples can still be read for audit/migration
- OAuth-client login eligibility has a separate model name: `oauth_client_login`

Notes:

- UI was not migrated yet
- old client `Platform Access` mutation will fail closed by default until the UI/action layer is replaced

---

## Phase 3: Normalize Auth-Space Models

Implemented:

- alias schema and repository support
- `scripts/migrate-space-model-identities.ts`

Migration helper behavior:

- dry-run by default
- `--apply` creates alias rows for unambiguous `client_<clientId>:<model>` space-owned models
- `--apply` renames canonical entity type to `space_<authorizationSpaceId>:<model>`
- `--apply` updates tuple entity type strings for tuples linked by `entityTypeId`

Notes:

- this does not automatically resolve models without `authorizationSpaceId`
- ambiguous models still require operator mapping
- Payload/webhook/config consumers still need follow-up work before broad production application

---

## Verification

Ran in `/home/quanghuy1242/pjs/auther`:

```text
pnpm exec tsc --noEmit
node --import tsx --test tests/registration-grants.metrics.test.ts tests/registration-context-grants.test.ts tests/permission-service.full-access-fast-path.test.ts
pnpm run lint
git diff --check
```

Results:

- typecheck passed
- focused tests passed: 18/18
- lint passed
- diff check passed

---

## Remaining Non-UI Follow-Up

Still needed before UI phase is complete:

1. run audit scripts against real/staging data and attach reports
2. review ambiguous client-prefixed models and map them to spaces manually
3. decide when to run `migrate-space-model-identities.ts --apply`
4. update Payload/webhook/runtime consumers to prefer canonical model identity
5. wire global admin actions to `PlatformAccessService`
6. replace old client registration context write flows with explicit target/trigger flows
7. replace or disable `applyClientContextGrants` authorize-time mutation
8. implement durable pending context application consumption path
9. unify invite creation and verification services
10. rebuild auth-space access UI after the write/read model is stable
