# Auth Correction Execution Order

> Status: sequencing plan for the auth-space and platform-registration correction docs
>
> Date: 2026-05-06
>
> Related documents:
>
> - `docs/auth-space-access-control-implementation-plan.md`
> - `docs/auth-platform-registration-access-correction-plan.md`

---

## 1. Goal

The goal is to finish the auth correction with one coherent access model, not two partially connected models.

Correct final shape:

- platform access is global control-plane access
- authorization-space access is resource authorization inside a space
- OAuth clients are integration/login channels, not owners of platform access or resource models
- registration contexts explicitly say what triggers them and what they grant
- permission requests explicitly say what target they request
- API keys are presented and governed as space-scoped service accounts, even while Better Auth storage still needs an internal backing client

The corrected system should answer these questions without guessing from `clientId`:

1. Who can administer Auther?
2. Who can administer users, groups, clients, spaces, requests, invites, and templates?
3. Which models belong to this authorization space?
4. Which users, groups, and service accounts have access to resources in this space?
5. Which OAuth clients can connect to or trigger flows for this space?
6. Which registration flow granted this permission, and why?
7. Which request target is being approved?

Non-goals:

- preserving the old client-centric model as a second permanent model
- keeping `client_<clientId>:` as canonical resource-model identity
- treating `oauth_client owner/admin/use` as platform access
- keeping nullable `clientId` as the meaning of platform-vs-client scope
- making the old four-tab client `AccessControl` component look correct enough to survive

Compatibility is allowed only as a migration tool. Every compatibility path must have an owner, audit visibility, and a removal condition.

---

## 2. Recommendation

Do the platform/global access and legacy-write freeze first.

Reason: before rebuilding the auth-space UI, the system must stop creating more client-centric access data. If the project starts with React tabs or page composition, the UI will keep preserving the stale model underneath.

First implementation slice:

1. add audit scripts for both documents
2. freeze legacy writes
3. add explicit target/trigger schema for contexts, requests, and rules
4. add authorization-space model alias schema
5. move platform access writes to global system-model tuples

This is the lowest-risk aggressive path: it does not delete data first, but it immediately stops the wrong model from expanding.

---

## 3. What Not To Do First

Do not start with:

- polishing the four auth-space tabs
- renaming labels in the old client `AccessControl` component
- moving `Platform Access` visually while it still writes `oauth_client owner/admin/use`
- adding more client-aware filters to make the current UI look correct
- adding new registration-context features on top of `registration_contexts.client_id`
- preserving `client_<clientId>:` as the canonical model name because Payload currently uses it

Those changes may make the admin UI look cleaner while hardening the wrong architecture.

---

## 4. Phase 0: Audit And Freeze

Goal: understand the live data shape and stop new legacy writes.

Deliverables:

- `/home/quanghuy1242/pjs/auther/scripts/audit-authorization-space-access.ts`
- `/home/quanghuy1242/pjs/auther/scripts/audit-platform-registration-access.ts`
- server-side guards around legacy write paths
- operator-visible report of ambiguous rows

Audit auth-space data:

1. models with `authorizationSpaceId`
2. models with `client_<clientId>:` prefixes
3. models with no `authorizationSpaceId`
4. tuples with client-prefixed entity types
5. tuples with missing `authorizationSpaceId`
6. API keys with `oauth_client_id` and missing `authorization_space_id`
7. registration-context grants that point at client-prefixed models
8. webhook/Payload integration references to client-prefixed model names

Audit platform/registration data:

1. `oauth_client owner/admin/use` tuples
2. `registration_contexts.client_id`
3. `permission_requests.client_id`
4. `permission_rules.client_id`
5. `grantProjectionClientIds`
6. stale `user_client_access` and `group_client_access`
7. pending invites that cannot be verified by the active invite verifier
8. OAuth authorize-time context grant applications

Freeze rules:

1. no new client-prefixed authorization-space model writes
2. no new `oauth_client owner/admin/use` platform-access writes
3. no new nullable-client context/request/rule writes
4. no new `grantProjectionClientIds` writes outside migration tooling
5. no new invite format divergence

Acceptance:

- existing runtime can still read old data
- every new write path either uses the target schema or is explicitly blocked
- audit output is good enough to estimate migration size and ambiguous cases

---

## 5. Phase 1: Target Schema And Compatibility Adapters

Goal: add the corrected model without deleting legacy data.

Auth-space schema:

- add `authorization_model_aliases`
- add lookup by `(authorizationSpaceId, aliasEntityType)`
- add canonical model identity using `authorizationSpaceId + modelKey`
- keep Better Auth API-key backing client as private storage bridge only

Platform/registration schema:

- add explicit trigger/target fields to `registration_contexts`
- add explicit request target fields to `permission_requests`
- add explicit trigger/target fields to `permission_rules`
- add durable pending registration-context applications
- add one invite token service

Global access schema:

- ensure missing system models exist, including `authorization_spaces`, `registration_contexts`, `permission_requests`, and `policy_templates`
- add platform-access service that writes system-model tuples
- add optional `oauth_client_login` model only if login eligibility must remain user/group configurable

Acceptance:

- target writes are possible
- legacy reads still work through adapters
- no UI needs to know about the canonical backing client

---

## 6. Phase 2: Migrate Platform Access First

Goal: make "who can administer this system" globally correct before changing resource-management workflows.

Tasks:

1. replace client `Platform Access` writes with global platform-access writes
2. remove `Platform Access` from auth-space and client access-control tabs
3. convert safe legacy tuples:
   - `oauth_client:<id>:use` may become `oauth_client_login:<id>:allowed` if login eligibility is still required
   - `oauth_client:<id>:admin/owner` requires manual review; do not equate it to global admin
4. update guards to use system-model tuples for admin/control-plane pages
5. leave old tuples visible only in audit/legacy views

Acceptance:

- global admin access is no longer client-owned
- no visible page calls `oauth_client owner/admin/use` platform access
- object-level OAuth-client administration, if needed, is separately named and modeled

---

## 7. Phase 3: Normalize Auth-Space Models

Goal: remove OAuth-client id from canonical resource-model identity.

Tasks:

1. generate canonical model keys for each space-owned model
2. create aliases from `client_<clientId>:<model>` to canonical model ids
3. update permission checks to resolve by model id or `(authorizationSpaceId, modelKey)`
4. update tuple writers to emit canonical model identity
5. update API-key grant writers to emit canonical model identity
6. update registration-context grants to emit canonical model identity
7. update webhooks/Payload integration to include canonical id and legacy alias only as compatibility metadata
8. backfill unambiguous tuples to include `authorizationSpaceId` and canonical entity type

Acceptance:

- no new client-prefixed model names are created
- old checks work through aliases
- active models have space-native canonical identity
- ambiguous models are listed for manual operator mapping

---

## 8. Phase 4: Rebuild Auth-Space Access UI

Goal: make `/admin/authorization-spaces/[id]/access` the resource-authorization management surface.

Tabs:

1. `Models`
2. `Resource Grants`
3. `Service Accounts`
4. `Linked Clients`

Rules:

- no old `AccessControl` component import
- no browser-provided `clientId`
- no `Platform Access` tab
- no model filtering by backing client
- no API-key visibility based only on `oauth_client_id`
- linked clients are displayed as integration channels, not access owners

Acceptance:

- each tab uses an authorization-space service
- every mutation requires `authorizationSpaceId`
- API keys are space-scoped even if Better Auth stores them under a backing client internally

---

## 9. Phase 5: Rewrite Registration Contexts, Invites, And Requests

Goal: make registration and request flows target global access, auth-space resources, or OAuth-client login explicitly.

Tasks:

1. migrate context creation UI away from client pages
2. replace `applyClientContextGrants` authorize-time mutation with explicit triggers or manual backfill
3. replace in-memory pending context grants with durable pending rows
4. unify invite token creation and verification
5. expire or reissue incompatible pending invites
6. rewrite permission requests to explicit target kinds
7. remove client request pages or turn them into filtered views of explicit target requests

Acceptance:

- a context says exactly what triggers it and exactly what it grants
- a request says exactly what target it is requesting
- registration grants survive process restarts
- old invite format mismatch is gone

---

## 10. Phase 6: Remove Compatibility

Goal: delete old paths after metrics prove they are unused.

Removal checklist:

1. remove old client access-control actions from auth-space routes
2. remove old client-prefixed model write helpers
3. retire alias rows after no runtime reads use them
4. remove `grantProjectionClientIds`
5. remove nullable-client write paths
6. remove or archive `user_client_access` and `group_client_access`
7. remove `oauth_client owner/admin/use` fallback from platform access
8. remove authorize-time context grant mutation

Acceptance:

- compatibility can be disabled in production without failed checks
- audit scripts return zero active legacy writes
- docs and UI no longer describe platform access as client-owned

---

## 11. Definition Of Done

The entire correction is done only when all of these are true.

### 11.1 Data Model Done

- active authorization-space models have canonical space-owned identity
- no active model uses an OAuth-client id as its canonical identity
- `client_<clientId>:` entity types exist only as retired aliases, historical audit data, or documented manual holdouts
- every active resource tuple is tied to an authorization space when the model is space-owned
- `authorization_model_aliases` can be disabled without breaking current writes
- model create/update/delete APIs require `authorizationSpaceId`
- model rename/delete cannot operate by `clientId + entityType` alone

### 11.2 Platform Access Done

- platform access is stored through global system-model tuples
- admin/control-plane guards use platform/system-model permissions
- no page labels `oauth_client owner/admin/use` as platform access
- no user-facing mutation creates `oauth_client owner/admin/use`
- old `oauth_client owner/admin/use` tuples have been migrated, archived, or manually accepted as non-platform legacy data
- object-level OAuth-client administration, if retained, has a separate model and label
- OAuth-client login eligibility, if retained, is represented as `oauth_client_login` or another explicitly named login model

### 11.3 Auth-Space Access UI Done

- `/admin/authorization-spaces/[id]/access` does not import the old client `AccessControl` component
- the page has space-native `Models`, `Resource Grants`, `Service Accounts`, and `Linked Clients` surfaces
- the page does not contain a `Platform Access` tab
- every mutation receives and validates `authorizationSpaceId`
- no action trusts a browser-provided `clientId` to determine space ownership
- model listing is by `authorizationSpaceId`, not backing client
- linked clients are shown as integrations/channels, not as access owners
- API-key/service-account listing requires `authorization_space_id`, not only `oauth_client_id`

### 11.4 Registration Context Done

- new registration contexts use explicit trigger and target fields
- new registration contexts do not write `registration_contexts.client_id`
- context grants can target platform access, authorization-space resources, or OAuth-client login explicitly
- context grant application is durable and retry-safe
- in-memory pending grant state is removed or no longer required for correctness
- OAuth authorize does not silently apply all matching client/platform contexts by default
- any remaining authorize-time grant behavior is explicitly configured and audited
- `grantProjectionClientIds` is removed or read-only migration metadata with no active writer

### 11.5 Invite Done

- invite creation and invite verification use one token format
- pending invites that cannot be verified are expired or reissued
- admin-created user flows apply selected registration context grants through the same service path as invite/self-registration flows
- consumed invite records can explain which context was applied, when, and to which user
- duplicate invite consumption cannot duplicate grants

### 11.6 Permission Request Done

- new permission requests use explicit target kind and target id
- new permission requests do not write `permission_requests.client_id`
- approval logic writes platform grants, authorization-space grants, or OAuth-client login grants based on target kind
- client request pages are removed or are filtered views over explicit target requests
- request history can explain what was requested, what was approved, and which tuples were created

### 11.7 Policy Template And Rule Done

- policy templates reference validated system models unless a separate space-template feature is implemented
- templates do not reference client-prefixed resource models
- permission rules use explicit trigger and target fields
- new permission rules do not write `permission_rules.client_id`
- template/rule application uses shared grant application helpers
- deleting or renaming a model/relation checks for template and rule dependencies

### 11.8 Runtime And Integration Done

- permission checks prefer model id or `(authorizationSpaceId, modelKey)` over raw client-prefixed entity type
- tuple writers emit canonical model identity for new resource grants
- API-key grant writers emit canonical model identity
- registration-context grant writers emit canonical model identity
- webhook payloads include canonical model identity
- Payload integration no longer requires client-prefixed model names as canonical config
- Better Auth backing client logic is private storage plumbing and not visible as the access model

### 11.9 Migration And Observability Done

- audit scripts exist and are safe to run repeatedly
- audit scripts report zero active legacy writes
- ambiguous legacy rows have operator decisions recorded
- migration scripts are idempotent or have explicit resume behavior
- every compatibility adapter emits enough telemetry to know whether it is still used
- production/staging migration reports are attached to the implementation tickets
- rollback steps preserve data and do not re-enable stale write paths by default

### 11.10 Cleanup Done

- old client access-control actions are not used by auth-space routes
- old client-prefixed model write helpers are removed or legacy-gated with no active callers
- nullable-client write paths are removed or hard-blocked
- `user_client_access` and `group_client_access` are removed, archived, or documented as unrelated to platform/resource access
- compatibility flags can be disabled without failed tests or runtime errors
- docs and UI consistently describe the same target model

### 11.11 Verification Done

- unit tests cover platform access grants/revokes
- unit tests cover model alias resolution and canonical model writes
- unit tests cover auth-space grant writes by `authorizationSpaceId`
- unit tests cover registration-context target parsing and durable application
- unit tests cover invite token creation/verification/consumption
- unit tests cover permission-request approval for each target kind
- integration tests cover OAuth login without unintended context grants
- integration tests cover service-account/API-key permission resolution inside one space
- manual admin QA confirms no visible platform access flow is client-owned
- `typecheck`, lint, and relevant test suites pass

The project is not done if it only has cleaner pages over the old model. It is done when new writes, runtime checks, admin UI, migrations, and documentation all agree on the corrected ownership boundaries.

---

## 12. Practical First Ticket

Create one first ticket that is intentionally cross-cutting:

Title:

```text
Freeze legacy auth access writes and add audit reports
```

Scope:

1. add both audit scripts
2. add server-side guards/logging around legacy writes
3. add explicit TODO markers with ticket ids at each legacy call site
4. produce a migration report from local/staging data

Do not include:

- deleting data
- rebuilding the whole UI
- changing Payload runtime behavior
- converting every tuple

This gives the team the facts needed for the aggressive migration while immediately preventing more stale data from being created.
