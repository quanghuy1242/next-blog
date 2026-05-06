# Platform Access, Registration Context, And Request Correction Plan

> Status: implementation-grade correction plan
>
> Date: 2026-05-06
>
> Scope: `/home/quanghuy1242/pjs/auther`
>
> Related plans:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/auth-migration-backlog.md`
> - `docs/auth-space-access-control-implementation-plan.md`

---

## 1. Purpose

This document extends the authorization-space access-control plan into the related control-plane surfaces:

- global platform access
- registration contexts
- platform invites
- permission requests
- permission rules / automation rules
- policy templates
- old OAuth-client `owner/admin/use` access tuples

The current implementation has useful building blocks, but the domain boundaries are wrong in several places. Some code already treats platform access as global system permissions. Other code still treats "platform access" as access to a specific OAuth client. Registration contexts and permission requests also use `clientId` as a scope switch, which made sense in the old client-owned authorization model but conflicts with the corrected model where resource grants live in authorization spaces.

The goal is the same as the main auth correction: correct pattern first, compatibility second. A working but conceptually wrong client-owned access model should not be preserved as the target.

### 1.1 Aggressive Revision: Replace Client-Centric Schemas, Do Not Normalize Around Them

The earlier stance still allowed too much old shape to survive as compatibility. The corrected stance is:

- `registration_contexts.client_id` is legacy trigger metadata, not the target ownership model
- `permission_requests.client_id` is legacy request metadata, not the target request model
- `permission_rules.client_id` is legacy automation metadata, not the target rule model
- `oauth_client_metadata.allows_registration_contexts` is not the target feature flag for registration contexts
- `oauth_client_metadata.grant_projection_client_ids` is migration metadata only
- `user_client_access` and `group_client_access` are stale compatibility tables unless a separate OAuth-client login product requirement is explicitly approved
- `oauth_client owner/admin/use` tuples must not represent platform access

The target model should use explicit records:

```text
registration context:
- triggerKind: platform | oauth_client | origin | invite | manual
- triggerClientId: nullable only when triggerKind = oauth_client
- targetKind: platform | authorization_space | oauth_client_login
- targetId: * | <authorizationSpaceId> | <clientId>

permission request:
- requestKind: platform | authorization_space | oauth_client_login
- targetId: * | <authorizationSpaceId> | <clientId>
- requestedRelation
- requestedModelId/entityId when resource-scoped

permission rule:
- triggerKind
- targetKind
- targetId
- grantPlan
```

Compatibility rules:

1. legacy rows can be read through adapters during migration
2. new writes must use explicit target/trigger fields
3. old nullable `clientId` fields should be frozen once the migration starts
4. old invite token formats should be invalidated and reissued if they cannot be verified consistently
5. OAuth authorize must not silently apply registration grants as a long-term behavior

This is bigger than a UI correction, but it avoids preserving the wrong product model.

---

## 2. Current Code Map

### 2.1 Schema

Platform/control-plane schema:

- `/home/quanghuy1242/pjs/auther/src/db/platform-access-schema.ts`

Current tables:

- `registration_contexts`
- `platform_invites`
- `permission_requests`
- `permission_rules`
- `policy_templates`

Related app schema:

- `/home/quanghuy1242/pjs/auther/src/db/app-schema.ts`

Current legacy/client-related fields:

- `user_client_access`
- `group_client_access`
- `oauth_client_metadata.allows_registration_contexts`
- `oauth_client_metadata.access_policy`
- `oauth_client_metadata.grant_projection_client_ids`

Authorization tuples:

- `/home/quanghuy1242/pjs/auther/src/db/rebac-schema.ts`
- `access_tuples`
- `authorization_models`

### 2.2 Repositories And Services

Primary repository:

- `/home/quanghuy1242/pjs/auther/src/lib/repositories/platform-access-repository.ts`

Runtime services:

- `/home/quanghuy1242/pjs/auther/src/lib/services/registration-context-service.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/services/permission-request-service.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/pipelines/registration-grants.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/utils/registration-context-grants.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/middleware/origin-validation.ts`
- `/home/quanghuy1242/pjs/auther/src/app/api/auth/verify-invite/route.ts`

Platform guard and permission model:

- `/home/quanghuy1242/pjs/auther/src/lib/auth/platform-guard.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/auth/system-models.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/auth/permission-service.ts`

OAuth authorize gate:

- `/home/quanghuy1242/pjs/auther/src/lib/auth.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/utils/oauth-authorization.ts`

### 2.3 Admin UI And Actions

Global Access page:

- `/home/quanghuy1242/pjs/auther/src/app/admin/access/page.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/access/actions.ts`
- `/home/quanghuy1242/pjs/auther/src/app/admin/access/access-client.tsx`

Global Requests page:

- `/home/quanghuy1242/pjs/auther/src/app/admin/requests/page.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/requests/actions.ts`
- `/home/quanghuy1242/pjs/auther/src/app/admin/requests/requests-client.tsx`

Client registration/request pages:

- `/home/quanghuy1242/pjs/auther/src/app/admin/clients/[id]/registration/page.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/clients/[id]/requests/page.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/clients/[id]/registration-actions.ts`
- `/home/quanghuy1242/pjs/auther/src/app/admin/clients/[id]/registration-tabs.tsx`

User invite/create/permission pages:

- `/home/quanghuy1242/pjs/auther/src/app/admin/users/invites-actions.ts`
- `/home/quanghuy1242/pjs/auther/src/app/admin/users/invites-tab.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/users/create/actions.ts`
- `/home/quanghuy1242/pjs/auther/src/app/admin/users/[id]/permissions-actions.ts`

Legacy embedded access-control component:

- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/platform-access.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/clients/[id]/access/actions.ts`

---

## 3. Current Concepts And What They Actually Mean

### 3.1 Platform Access

Correct meaning:

Platform access is access to administer or use Auther's control plane.

Examples:

- can open `/admin`
- can manage users
- can manage groups
- can manage OAuth clients
- can manage authorization spaces
- can manage webhooks
- can manage pipelines
- can approve permission requests
- can create invites

Correct tuple shape:

```text
entityType = platform | users | groups | clients | webhooks | pipelines | sessions | keys | api_keys
entityId = * or a specific object id if object-level delegation is explicitly designed
relation = model relation such as member/admin/viewer/editor
subjectType = user | group
```

The existing `platform-guard.ts` already expects this model:

```ts
guards.platform.admin() -> check platform:admin
guards.users.create() -> check users:create
guards.clients.update() -> check clients:update
guards.groups.manageMembers() -> check groups:manage_members
```

### 3.2 OAuth Client Access

Correct meaning:

An OAuth client is an application that requests login and tokens.

Client-specific access can mean one of two things:

1. OAuth client configuration management: who can edit the OAuth client record.
2. OAuth login eligibility: who is allowed to authenticate through a restricted OAuth client.

Neither is platform access.

The current tuple shape:

```text
entityType = oauth_client
entityId = <clientId>
relation = owner | admin | use
```

is a legacy mixed concept. It has been used for:

- editing access-control UI permissions
- deciding whether a user can authorize a restricted OAuth client
- gating model/API-key/grant edits in the old client access page

This should not be the target.

### 3.3 Registration Context

Correct meaning:

A registration context is an onboarding grant recipe. It defines what grants should be applied when a user signs up or accepts an invite through a specific onboarding path.

It is not:

- an OAuth client
- an authorization space
- a platform role by itself
- a permission request
- a policy template

It should answer:

- who or what entry point can use this sign-up flow?
- can it be used openly from specific origins?
- does it require signed invite?
- which grants does it apply?
- which authorization space or global control-plane scope do those grants belong to?
- should it auto-apply on every OAuth authorize, or only at registration/invite consumption?

### 3.4 Permission Request

Correct meaning:

A permission request is a user's request to receive a grant.

It should be scoped to one explicit grant target:

- global platform/control-plane permission
- authorization-space resource permission
- maybe OAuth client login eligibility if that feature remains

It should not use nullable `clientId` as the primary scope model.

### 3.5 Policy Template

Correct meaning:

A policy template is a reusable bundle of grants, mainly for global platform/user administration.

It should remain global unless the product explicitly adds space-scoped templates.

---

## 4. Current Anti-Patterns

### 4.1 "Platform Access" Is Split Between Correct And Incorrect Models

Correct model exists:

- system models in `src/lib/auth/system-models.ts`
- guards in `src/lib/auth/platform-guard.ts`
- tuples like `platform:*:admin` and `users:*:admin`

Incorrect/legacy model also exists:

- `PlatformAccess` UI in old client access control
- `getPlatformAccessList(clientId)`
- `grantPlatformAccess(clientId, ...)`
- `revokePlatformAccess(clientId, ...)`
- `getCurrentUserAccessLevel(clientId)`
- `PermissionService.getPlatformAccessLevel(userId, clientId)`
- `checkOAuthClientAccess` for restricted clients

The old model grants `oauth_client owner/admin/use` and calls that platform access. That should be deprecated.

### 4.2 Registration Contexts Are Client-Owned

Current schema:

```ts
registration_contexts.client_id // null = platform, set = client
```

Current behavior:

- client contexts are managed under `/admin/clients/[id]/registration`
- client contexts require `oauth_client_metadata.allowsRegistrationContexts`
- client contexts can target authorization-space models only if the OAuth client has `oauth_client_space_links.accessMode = can_trigger_contexts | full`
- old projection compatibility still uses `grantProjectionClientIds`

This mixes the entry application with the authorization grant target.

Correct target:

- a context may be triggered by an OAuth client or origin
- a context applies grants into explicit target scopes
- the context itself belongs to the global control plane, or optionally to an authorization space as a recipe
- the OAuth client does not own the grant namespace

### 4.3 Existing Users Get Context Grants During OAuth Authorize

`src/lib/auth.ts` calls:

```ts
applyClientContextGrants(clientId, userId)
```

during OAuth authorize.

That function applies:

1. all enabled contexts for that client
2. all enabled global platform contexts

This is risky because a login through a client can mutate durable permissions. It also makes global platform contexts auto-apply to existing users whenever they authorize any client.

Correct target:

- registration contexts should apply on registration or invite consumption
- catch-up/backfill for existing users should be explicit and auditable
- OAuth authorize should not silently grant new durable permissions unless a context policy explicitly says it is an authorize-time bootstrap and the event is logged

### 4.4 Pending Context Grants Are In Memory

`registration-grants.ts` stores queued grants in:

```ts
const pendingContextGrants = new Map<string, Array<{ contextSlug: string; inviteId?: string }>>();
```

This is not safe for:

- server restarts
- multiple instances
- edge/serverless execution
- concurrent sign-ups for the same email
- delayed email verification

Correct target:

- use a durable pending onboarding table
- associate pending application with email, invite id, context id, expiration, and consumed user id
- process idempotently after user creation/email verification

### 4.5 Invite Token Formats Conflict

There are two invite creation paths:

1. `RegistrationContextService.createSignedInvite`
   - creates base64url JSON token with HMAC signature
   - stores `tokenHash = signature`
   - URL: `/sign-up?invite=<token>`

2. `src/app/admin/users/invites-actions.ts:createInvite`
   - creates random hex token
   - stores `sha256(token)` as `tokenHash`
   - URL: `/auth/register?invite=<token>`

But `/api/auth/verify-invite` calls:

```ts
registrationContextService.validateInvite(token, email)
```

which expects the signed base64url/HMAC token format.

This means invites created from the users tab may not validate through the verify route.

Correct target:

- one invite token format
- one invite creation service
- one verify endpoint
- one registration URL

### 4.6 Admin User Creation Records Context But Does Not Apply Context Grants

`src/app/admin/users/create/actions.ts` can store a consumed pseudo-invite for a selected `contextSlug`, but it does not call `registrationContextService.applyContextGrants`.

It applies policy templates, then only records the context association.

Correct target:

- selecting a registration context during admin-created user flow should apply the same grant recipe, or the UI should not imply that it does
- consumed invite/context audit should be separate from grant application

### 4.7 Permission Requests Use Nullable Client Scope

Current request shape:

```ts
permission_requests.client_id // null = platform, set = client
permission_requests.relation
```

Approval grants:

```text
client request -> entityType = client_<clientId>, entityId = *
platform request -> entityType = platform, entityId = *
```

Problems:

- `client_<clientId>` is not the corrected authorization-space model
- relation alone is ambiguous without entity type/model
- request cannot represent a specific authorization-space model/relation/resource cleanly
- request cannot represent `users:update` vs `platform:admin` except by relation conventions

Correct target:

- permission request stores explicit grant target:
  - target kind
  - entity type or model id
  - entity id
  - relation
  - authorization space id when resource scoped

### 4.8 Policy Templates Store Raw Entity Types

Current template shape:

```ts
permissions: Array<{ entityType: string; entityId?: string; relation: string }>
```

This can work for global platform models, but it is fragile:

- no stable model id
- no authorization-space id
- no validation when model relation changes
- same entity display name can collide across spaces

Correct target:

- global templates should reference system model entity types explicitly and validate relations
- future space templates should use `entityTypeId + authorizationSpaceId`

---

## 5. Target Architecture

### 5.1 Separate The Three Access Families

#### Family A: Global Platform Control Plane

Examples:

- `platform:member`
- `platform:admin`
- `users:view`
- `users:update`
- `clients:create`
- `clients:update`
- `authorization_spaces:admin` if added

Managed in:

- global Access page
- user detail permissions
- group permissions
- policy templates
- permission requests
- invites/registration contexts that grant platform access

#### Family B: Authorization Space Resource Access

Examples:

- Payload content `book:viewer`
- Payload content `chapter:viewer`
- full access to authorization space `payload-content`

Managed in:

- `/admin/authorization-spaces/[id]/access`

#### Family C: OAuth Client Login Eligibility

Examples:

- a restricted OAuth client allows only employees
- a first-party admin app is trusted
- a private tool needs allowlist login

Managed separately if still required.

Possible tuple shape:

```text
entityType = oauth_client_login
entityId = <clientId>
relation = allowed
subjectType = user | group
```

Do not call this platform access.

Do not use it to authorize resource access.

Do not use it to authorize global control-plane operations.

### 5.2 Registration Context Target Model

Replace nullable `clientId` ownership with explicit context fields.

Suggested model:

```ts
registration_contexts {
  id: string
  slug: string
  name: string
  description: string | null
  kind: "open" | "invite_only" | "internal"
  triggerType: "platform" | "oauth_client" | "origin" | "manual"
  triggerClientId: string | null
  targetAuthorizationSpaceId: string | null
  enabled: boolean
  allowedOrigins: string[] | null
  allowedDomains: string[] | null
  applyOn: "registration_only" | "invite_acceptance" | "explicit_backfill"
  grants: RegistrationContextGrant[]
}
```

Grant shape:

```ts
type RegistrationContextGrant =
  | {
      targetKind: "platform";
      entityType: "platform" | "users" | "groups" | "clients" | "webhooks" | "pipelines" | "sessions" | "keys" | "api_keys";
      entityId: string; // usually "*"
      relation: string;
    }
  | {
      targetKind: "authorization_space";
      authorizationSpaceId: string;
      entityTypeId: string;
      entityId: string; // usually "*"
      relation: string;
    }
  | {
      targetKind: "oauth_client_login";
      clientId: string;
      relation: "allowed";
    };
```

Compatibility:

- continue to read old `grants: [{ entityTypeId, relation }]`
- infer `targetKind` from model ownership during migration
- stamp `authorizationSpaceId` on created tuples

### 5.3 Permission Request Target Model

Replace `clientId + relation` with explicit request target.

Suggested schema:

```ts
permission_requests {
  id: string
  userId: string
  targetKind: "platform" | "authorization_space" | "oauth_client_login"
  targetEntityType: string | null
  targetEntityTypeId: string | null
  targetEntityId: string
  targetAuthorizationSpaceId: string | null
  targetClientId: string | null
  relation: string
  reason: string | null
  status: "pending" | "approved" | "rejected"
  resolvedBy: string | null
  resolvedAt: Date | null
  resolutionNote: string | null
  requestedAt: Date
}
```

Approval writes tuple based on target kind:

```text
platform:
  entityType = targetEntityType
  entityId = targetEntityId
  relation = relation

authorization_space:
  entityType = model.entityType
  entityTypeId = targetEntityTypeId
  entityId = targetEntityId
  relation = relation
  authorizationSpaceId = targetAuthorizationSpaceId

oauth_client_login:
  entityType = oauth_client_login
  entityId = targetClientId
  relation = allowed
```

### 5.4 Permission Rules Target Model

Permission rules should match the request target, not just `clientId + relation`.

Suggested unique key:

```text
targetKind + targetEntityType + targetAuthorizationSpaceId + targetClientId + relation
```

Rules can then answer:

- can users request this permission themselves?
- who can approve?
- is auto-approval allowed?
- what Lua condition applies?

### 5.5 Platform Access UI Target

Global Access page should become the single place for platform-control access.

Suggested tabs/sections:

1. `System Permissions`
2. `Platform Members`
3. `Registration Contexts`
4. `Permission Requests`
5. `Policy Templates`
6. `Legacy Client Access Audit`

Do not put authorization-space resource grants here. Link to each space instead.

---

## 6. Detailed Correction Plan

## 6.1 Global Platform Access

### Current Problems

The current global Access page includes useful sections:

- `AuthorizationModelsSection`
- `PolicyTemplatesSection`
- `ClientWhitelistSection`
- `PlatformContextsSection`

But it does not directly manage platform members as first-class global access. The most complete member UI is the old client `PlatformAccess` tab, which writes `oauth_client owner/admin/use`.

### Target Behavior

Global platform access should grant system-model tuples:

```text
entityType = platform
entityId = *
relation = member | admin | super_admin

entityType = users
entityId = *
relation = viewer | admin

entityType = clients
entityId = *
relation = viewer | admin
```

The UI should show users and groups with their global platform permissions.

Examples:

- `Alice` has `platform:admin`
- `Support` group has `users:viewer`
- `Engineering Admins` group has `clients:admin`, `authorization_spaces:admin`

### Implementation Tasks

1. Create a global platform access service:
   - `src/lib/auth/platform-access-service.ts`
2. Add methods:
   - `listGlobalAccessSubjects()`
   - `grantGlobalPermission(subject, entityType, relation, entityId = "*")`
   - `revokeGlobalPermission(tupleId)`
   - `applyGlobalPolicyTemplate(subject, templateId)`
   - `listLegacyOAuthClientAccessTuples()`
3. Add missing system models if needed:
   - `authorization_spaces`
   - `resource_servers`
   - `registration_contexts`
   - `permission_requests`
   - `policy_templates`
4. Replace or supplement the global Access UI with a `Platform Members` section.
5. Remove any UI language that calls `oauth_client owner/admin/use` platform access.

### Edge Cases

- user has `role = admin` in Better Auth and no tuples
- group inheritance grants platform admin
- relation exists in a template but no longer exists in system model
- removing `platform:member` while user still has `users:viewer`
- user has global `clients:admin` and legacy OAuth-client `use`
- legacy tuple exists for deleted OAuth client
- group is deleted while tuples remain

### Tests

Add:

- `tests/platform-access-service.test.ts`
- `tests/platform-global-permissions-actions.test.ts`

Cases:

- grant platform permission to user
- grant platform permission to group
- guard allows through group inherited tuple
- applying template creates idempotent tuples
- legacy OAuth client access tuples are listed but not used as platform grants

---

## 6.2 OAuth Client Login Eligibility

### Current Problems

`checkOAuthClientAccess` currently checks restricted client access through:

```ts
permissionService.getPlatformAccessLevel(userId, clientId)
```

which reads:

```text
entityType = oauth_client
entityId = <clientId>
relation = owner | admin | use
```

This conflates client login eligibility with client administration and platform access.

### Target Behavior

Keep `oauth_client_metadata.accessPolicy` for now:

- `all_users`
- `restricted`

But when `restricted`, check a separate login-eligibility relation:

```text
entityType = oauth_client_login
entityId = <clientId>
relation = allowed
subjectType = user | group
```

Do not use `owner/admin/use`.

Do not use global `clients:admin` to allow login unless product explicitly wants admins to bypass restricted login.

### Migration

For each legacy tuple:

```text
oauth_client:<clientId>:use/admin/owner
```

decide:

- if relation `use`, migrate to `oauth_client_login:<clientId>:allowed`
- if relation `admin/owner`, do not automatically migrate to platform `clients:admin`; report for manual review

### Implementation Tasks

1. Add system model or custom model for `oauth_client_login`.
2. Add `OAuthClientLoginAccessService`.
3. Update `checkOAuthClientAccess`.
4. Add admin UI only if restricted client allowlists remain product-required.
5. Do not add this UI to authorization-space access.

### Edge Cases

- restricted client has no allowlist
- group allowlist should work
- first-party trusted client also restricted
- global platform admin tries to login through restricted client
- deleted client leaves login eligibility tuples

---

## 6.3 Registration Contexts

### Current Problems

Current registration contexts are split by `clientId`:

- `clientId = null`: platform context
- `clientId = set`: client context

Client contexts are managed from the client page and require `allowsRegistrationContexts`.

Runtime application is also broad:

- after user creation, in-memory queued contexts are applied
- during OAuth authorize, all contexts for the client are applied
- during OAuth authorize, all platform contexts are also applied

### Target Behavior

Registration contexts should be global onboarding recipes with explicit trigger and grant targets.

They can still be used by an OAuth client, but the OAuth client is the trigger, not the owner of the authorization namespace.

Suggested context categories:

1. `Global platform onboarding`
   - grants platform/system permissions
   - invite-only by default
2. `Authorization-space onboarding`
   - grants resource permissions in one authorization space
   - e.g. blog registration grants `payload-content/book viewer`
3. `OAuth-client entry onboarding`
   - triggered by a specific OAuth client
   - still grants into platform or authorization-space targets
4. `Internal admin-created user context`
   - only used by admin user creation

### Apply-On Rules

Add explicit apply semantics:

```ts
applyOn:
  | "registration_only"
  | "invite_acceptance"
  | "admin_user_creation"
  | "explicit_backfill"
```

Do not silently apply all contexts on OAuth authorize.

Authorize-time grant application should be replaced with:

- explicit bootstrap/backfill job, or
- explicit context flag `applyOnAuthorize = true` during migration only

### Durable Pending Context Application

Replace in-memory `pendingContextGrants` with a table:

```ts
pending_registration_context_applications {
  id: string
  email: string
  contextSlug: string
  inviteId: string | null
  status: "pending" | "applied" | "failed" | "expired"
  expiresAt: Date
  createdAt: Date
  appliedAt: Date | null
  appliedToUserId: string | null
  error: string | null
}
```

Apply after user creation by querying pending rows for the normalized email.

Idempotency:

- grant application uses `createIfNotExists`
- pending row transitions must be atomic
- invite consumption and context application should happen in one service transaction if possible

### Validation Rules

Context creation/update must validate:

- slug uniqueness and format
- no wildcard `allowedOrigins = ["*"]` in production unless explicitly allowed
- every grant target exists
- relation exists on the target model/system model
- authorization-space targets are enabled
- OAuth client trigger is linked to target authorization space with `can_trigger_contexts | full`
- platform grants can only be configured by users with `platform:admin` or a specific `registration_contexts:admin` permission
- context cannot grant `platform:super_admin` unless actor has `platform:super_admin`

### Runtime Grant Application

When applying a context:

1. load context by slug
2. reject disabled context unless applying a historical consumed invite and policy allows it
3. validate target grants again
4. create tuples:
   - platform target -> system tuple
   - authorization-space target -> space tuple with `authorizationSpaceId`
   - OAuth login target -> `oauth_client_login`
5. emit metrics and audit events
6. mark pending application applied/failed
7. consume invite if present

### Edge Cases

- user verifies email hours after pending in-memory map would have disappeared
- two sign-up attempts for same email/context
- invite email lock case-insensitive mismatch
- context disabled after invite was created
- context grant model relation removed after invite creation
- origin header missing
- referer contains path but allowed origin expects origin
- wildcard origin accidentally grants platform admin
- context grants both platform and space permissions
- context is deleted while pending invite exists
- invite token is reused
- invite was created by a user who later loses permission

### Tests

Add:

- `tests/registration-context-service.durable.test.ts`
- `tests/registration-context-targets.test.ts`
- `tests/registration-context-apply.test.ts`

Cases:

- platform grant context creates system tuple
- authorization-space context creates tuple with `authorizationSpaceId`
- disabled context cannot be used for new registration
- removed relation blocks context update
- pending application survives service restart simulation
- duplicate pending application is idempotent
- OAuth authorize does not apply contexts by default after migration flag is off

---

## 6.4 Invites

### Current Problems

There are two token formats and two URLs.

Service path:

- `RegistrationContextService.createSignedInvite`
- signed base64url JSON/HMAC token
- `/sign-up?invite=...`

Users tab path:

- `src/app/admin/users/invites-actions.ts:createInvite`
- random hex token
- SHA-256 hash
- `/auth/register?invite=...`

Verify path:

- `/api/auth/verify-invite`
- expects service signed token

### Target Behavior

One invite service owns all invite creation and verification.

Suggested API:

```ts
registrationInviteService.createInvite({
  contextSlug,
  invitedBy,
  email,
  expiresInDays
})

registrationInviteService.verifyInvite({
  token,
  email
})

registrationInviteService.consumeInvite({
  inviteId,
  userId
})
```

Suggested token:

- random opaque token
- store only SHA-256 hash
- no context/user data in token body
- all authoritative invite data comes from DB

Rationale:

- easier revocation
- no duplicated HMAC payload validation
- safer if context changes
- no token payload drift

### Implementation Tasks

1. Pick one URL:
   - `/sign-up?invite=...` or `/auth/register?invite=...`
2. Update all invite creation to call the same service.
3. Update `/api/auth/verify-invite` to verify the chosen format.
4. Remove or deprecate `RegistrationContextService.createSignedInvite` if opaque DB tokens are chosen.
5. Ensure invite verification queues durable pending context application.
6. Ensure invite consumption happens after user creation succeeds.

### Edge Cases

- token hash collision is practically impossible but still use unique index if added
- invite email is null
- invite email has different case
- expired invite verification
- consumed invite verification
- context disabled after invite creation
- inviter user deleted
- invite deleted after verify but before signup completes

---

## 6.5 Permission Requests

### Current Problems

Global requests page only reads `clientId = null`.

Client requests page reads `clientId = <clientId>`.

Approval writes:

```text
client request -> client_<clientId>:*:<relation>
platform request -> platform:*:<relation>
```

This cannot express corrected authorization-space grants and keeps client-owned permission scope alive.

### Target Behavior

Permission requests should be global queue items with explicit targets.

Admin UI should have filters:

- target kind
- status
- requester
- authorization space
- target entity/model
- relation

Approval should be handled by target-specific approver rules:

- platform request -> platform admin or configured approver relation
- authorization-space request -> platform admin for now, later space grant manager
- OAuth login request -> client login policy manager if that feature exists

### Implementation Tasks

1. Add target columns to `permission_requests`.
2. Add target columns to `permission_rules`.
3. Update `PermissionRequestService.submitRequest`.
4. Update global `/admin/requests` to show all request target kinds.
5. Remove or redirect `/admin/clients/[id]/requests` once client-scoped request target is deprecated.
6. Approval creates tuples through target-specific grant service.

### Validation

On request submit:

- target exists
- relation exists
- user does not already have grant
- no pending duplicate request for same target/relation/user
- rule allows self-request or actor is admin-created

On approval:

- request still pending
- target still exists
- relation still exists
- approver has permission for target
- tuple write is idempotent

### Edge Cases

- request target deleted before approval
- relation removed before approval
- user already received permission through another path
- auto-approve condition errors
- auto-reject condition errors
- request for `platform:super_admin`
- request for authorization-space full access
- request for specific resource id
- request submitted through old client API during migration

---

## 6.6 Policy Templates

### Current Problems

Policy templates are global, which is mostly right, but their grant shape is raw:

```ts
{ entityType, entityId?, relation }
```

This is fine for system models only if validation is strong.

### Target Behavior

For now, keep templates global and system-model-only.

Template grant shape:

```ts
{
  targetKind: "platform";
  entityType: string;
  entityId: string;
  relation: string;
}
```

Future space templates can be added separately:

```ts
{
  targetKind: "authorization_space";
  authorizationSpaceId: string;
  entityTypeId: string;
  entityId: string;
  relation: string;
}
```

### Implementation Tasks

1. Validate template grants against `SYSTEM_MODELS` or DB overrides.
2. Prevent templates from referencing client-prefixed models unless a future space-template mode is explicitly added.
3. Update `applyTemplateToUsers`, `applyTemplateToUser`, and admin user creation to use a shared grant application helper.
4. Add dependency checks before deleting model relations used by templates.

### Edge Cases

- template references a removed relation
- template references a custom DB override of a system model
- template grants `platform:super_admin`
- template partially applies then errors
- group template application

---

## 7. Data Migration Plan

### 7.1 Audit Script

Create:

- `/home/quanghuy1242/pjs/auther/scripts/audit-platform-registration-access.ts`

Report:

1. all `oauth_client owner/admin/use` tuples
2. all `client_<clientId>` tuples without `authorizationSpaceId`
3. all registration contexts with `clientId`
4. all contexts whose grants target authorization-space models
5. all contexts whose grants target models with `authorizationSpaceId = null`
6. all permission requests with `clientId`
7. all permission rules with `clientId`
8. all policy templates referencing non-system entity types
9. all invites whose token format cannot be verified by current route
10. all admin-created consumed pseudo-invites without matching grants

### 7.2 Migration Steps

#### Step 0: Freeze Legacy Writes

Before adding new UI or polishing existing pages, stop creating more data in the wrong shape.

Tasks:

1. block or legacy-gate new `registration_contexts.client_id` writes
2. block or legacy-gate new `permission_requests.client_id` writes
3. block or legacy-gate new `permission_rules.client_id` writes
4. block new `grantProjectionClientIds` writes except inside migration tooling
5. block all new `oauth_client owner/admin/use` writes from any page labeled platform access
6. route new invites through one invite service and one token format
7. add audit logs for any legacy write path still used

Acceptance:

- the system can still read existing legacy data
- new admin workflows do not create additional client-scoped platform/context/request data
- legacy write attempts are visible with route, user, and payload summary

#### Step 1: Add New Columns Additively

Add target columns to:

- `registration_contexts`
- `permission_requests`
- `permission_rules`

Add durable pending table:

- `pending_registration_context_applications`

Optional:

- `authorization_space_metadata` if not placing API-key/context settings on `authorization_spaces`

#### Step 2: Backfill Registration Context Targets

For each context:

- if `clientId IS NULL`, mark trigger type `platform`
- if `clientId IS NOT NULL`, mark trigger type `oauth_client` and `triggerClientId = clientId`
- for each grant:
  - load `authorization_models.id`
  - if model has `authorizationSpaceId`, set grant target kind `authorization_space`
  - else if model entity type is a system model, set target kind `platform`
  - else report unresolved legacy grant

#### Step 3: Backfill Permission Requests

For each request:

- if `clientId IS NULL`, target platform `entityType = platform`, `entityId = *`, `relation = request.relation`
- if `clientId IS NOT NULL`, mark as legacy client request for manual review
- do not blindly convert client requests into authorization-space grants

#### Step 4: Migrate OAuth Client Login Eligibility

For legacy `oauth_client` tuples:

- `use` -> candidate `oauth_client_login allowed`
- `admin/owner` -> manual review

Keep old tuples only as read fallback until `checkOAuthClientAccess` no longer reads them or fallback is explicitly disabled. Do not write new `oauth_client owner/admin/use` tuples during this period.

#### Step 5: Unify Invites

Pick token format and migrate operational code first.

Existing pending invite rows can remain valid only if their token can be verified. If the token was only shown once and not stored, old invites may need to be invalidated and recreated.

---

## 8. Implementation Backlog

## R6-0. Replace Legacy Scope Schema First

This is the first implementation slice for this document. Starting with UI or page-level behavior would preserve the nullable-client model. The schema and write-path freeze should happen first.

### R6-0A Add Explicit Target Columns And Legacy Freeze Guards

Files:

- `src/db/platform-access-schema.ts`
- `src/lib/repositories/platform-access-repository.ts`
- `src/app/admin/clients/[id]/registration-actions.ts`
- `src/app/admin/requests/actions.ts`
- `src/app/admin/clients/[id]/requests/actions.ts`

Tasks:

1. add explicit target/trigger columns for contexts, requests, and rules
2. add repository write methods that require target/trigger objects
3. mark old `clientId` write methods as legacy-only
4. add feature flag or environment guard for any unavoidable old write path
5. add runtime logging for legacy writes

Acceptance:

- new context/request/rule creation cannot rely on nullable `clientId`
- legacy reads still work
- every remaining legacy write has an intentional call site

### R6-0B Replace OAuth-Client Platform Access Writes

Files:

- `src/components/admin/access-control/platform-access.tsx`
- `src/app/admin/clients/[id]/access/actions.ts`
- `src/app/admin/access/actions.ts`
- `src/lib/auth/platform-access-service.ts`

Tasks:

1. remove platform-access writes from the client access component
2. expose global platform access writes through `platform-access-service`
3. keep an audit-only view of legacy `oauth_client owner/admin/use` tuples
4. add a separate OAuth-client login eligibility concept only if still needed

Acceptance:

- no user-facing path calls `oauth_client owner/admin/use` platform access
- global admin access is stored through system-model tuples
- OAuth-client login eligibility, if retained, is named and stored separately

### R6-0C Reissue Or Expire Incompatible Invites

Files:

- `src/lib/services/registration-context-service.ts`
- `src/app/admin/users/invites-actions.ts`
- `src/app/api/auth/verify-invite/route.ts`
- migration/audit script

Tasks:

1. choose the signed invite token format as the only supported format or explicitly choose a replacement
2. detect pending rows that cannot be verified by the chosen verifier
3. expire incompatible pending rows with an operator-visible reason
4. create a reissue command for admins

Acceptance:

- `/api/auth/verify-invite` and invite creation agree on one format
- no pending invite appears valid in the UI if it cannot be verified at registration time

## R6-A. Global Platform Access

### R6-A1 Add Global Platform Access Service

Files:

- `src/lib/auth/platform-access-service.ts`
- `src/app/admin/access/actions.ts`

Tasks:

1. implement global subject listing
2. implement grant/revoke global permission
3. implement template application through shared helper
4. implement legacy OAuth-client tuple audit read

Acceptance:

- no writes to `oauth_client owner/admin/use`
- guards continue to pass from system-model tuples

### R6-A2 Add Missing System Models

Files:

- `src/lib/auth/system-models.ts`

Tasks:

1. add `authorization_spaces`
2. add `resource_servers`
3. add `registration_contexts`
4. add `permission_requests`
5. add `policy_templates`

Acceptance:

- every global admin page has a matching system model and guard path

## R6-B. Registration Context Rewrite

### R6-B1 Add Explicit Context Target Schema

Files:

- `src/db/platform-access-schema.ts`
- `src/lib/repositories/platform-access-repository.ts`

Tasks:

1. add target/trigger/apply columns
2. preserve old `clientId` during migration
3. add typed grant parser that supports old and new grant shapes

Acceptance:

- old contexts still read
- new contexts can target platform or authorization spaces explicitly

### R6-B2 Add Durable Pending Context Applications

Files:

- `src/db/platform-access-schema.ts`
- `src/lib/pipelines/registration-grants.ts`
- `src/lib/services/registration-context-service.ts`

Tasks:

1. replace in-memory queue with DB-backed queue
2. apply pending rows after user creation
3. mark rows applied/failed
4. add retry-safe idempotency

Acceptance:

- pending context survives process restart
- duplicate sign-up attempts do not duplicate grants

### R6-B3 Stop Default Authorize-Time Grant Mutation

Files:

- `src/lib/auth.ts`
- `src/lib/pipelines/registration-grants.ts`

Tasks:

1. remove or feature-flag `applyClientContextGrants` in OAuth authorize
2. add explicit backfill command for existing users
3. audit metrics for any authorize-time applications during transition

Acceptance:

- OAuth authorize does not silently grant platform/global contexts by default

## R6-C. Invite Unification

### R6-C1 Create One Invite Service

Files:

- `src/lib/services/registration-invite-service.ts`
- `src/lib/services/registration-context-service.ts`
- `src/app/admin/users/invites-actions.ts`
- `src/app/api/auth/verify-invite/route.ts`

Tasks:

1. choose token format
2. route all creation through one service
3. route all verification through one service
4. use one registration URL
5. queue durable context application on verify

Acceptance:

- invite created in users tab validates through verify endpoint
- signed/opaque format mismatch is gone

## R6-D. Permission Requests Rewrite

### R6-D1 Add Explicit Request Targets

Files:

- `src/db/platform-access-schema.ts`
- `src/lib/services/permission-request-service.ts`
- `src/app/admin/requests/actions.ts`

Tasks:

1. add target columns
2. validate target on submit
3. create target-specific tuple on approval
4. show all target kinds in global requests page

Acceptance:

- authorization-space permission request can be approved into a space tuple
- legacy client request is reported or handled through compatibility path only

### R6-D2 Deprecate Client Requests Page

Files:

- `src/app/admin/clients/[id]/requests/page.tsx`
- `src/app/admin/clients/[id]/registration-tabs.tsx`

Tasks:

1. remove client-owned request UI
2. link to global requests filtered by target client/login eligibility if needed
3. keep compatibility read-only view only during migration

Acceptance:

- permission request queue is global
- request scope is explicit

## R6-E. Policy Template Hardening

### R6-E1 Validate Template Grants

Files:

- `src/app/admin/access/actions.ts`
- `src/app/admin/users/[id]/permissions-actions.ts`
- `src/app/admin/users/create/actions.ts`
- `src/lib/auth/platform-access-service.ts`

Tasks:

1. validate relation exists before save
2. validate relation exists before apply
3. fail closed on missing system model
4. centralize template grant application

Acceptance:

- invalid templates cannot be created
- stale templates fail with clear error before partial grant application

## R6-F. Compatibility And Cleanup

### R6-F1 Audit Legacy Client Access

Files:

- `scripts/audit-platform-registration-access.ts`

Tasks:

1. report all `oauth_client owner/admin/use`
2. report all callers of `getPlatformAccessLevel`
3. report clients with `accessPolicy = restricted`
4. recommend `oauth_client_login allowed` migration candidates

Acceptance:

- migration owner can see exact blast radius before removing legacy checks

### R6-F2 Remove Misleading Names

Files:

- `src/components/admin/access-control/platform-access.tsx`
- `src/app/admin/clients/[id]/access/actions.ts`
- docs/comments

Tasks:

1. stop calling OAuth-client tuples "platform access"
2. rename remaining compatibility functions to `legacyClientAccess` or `oauthClientLoginEligibility`
3. prevent new code from importing old client access actions for platform management

Acceptance:

- no UI encourages platform access as a client-owned concept

---

## 9. Things That Are Easy To Miss

1. `platform:admin` and `oauth_client:<id>:admin` are not the same thing.
2. `clients:admin` means control-plane permission to manage OAuth client records; it does not mean resource access to a client-owned namespace.
3. Registration contexts should not mutate permissions on every OAuth authorize by default.
4. In-memory pending context grants will fail in multi-instance/serverless deployments.
5. The users invite UI currently creates tokens the verify endpoint does not understand.
6. Admin-created users with selected context currently record context association without applying context grants.
7. Permission request `relation` is ambiguous without target entity/model.
8. `grantProjectionClientIds` is migration metadata and should not be part of the target registration-context model.
9. A context that grants `platform:admin` is high-risk and must require stronger actor permission than creating a normal invite.
10. Legacy `client_<clientId>` tuples may represent resource grants, old client-scoped permissions, or broken historical state; audit before converting.

---

## 10. Completion Criteria

This correction is complete when:

1. Platform access is managed globally through system-model tuples.
2. No auth-space page or client page presents `oauth_client owner/admin/use` as platform access.
3. OAuth client login eligibility, if retained, is modeled separately from platform access.
4. Registration contexts have explicit trigger and grant targets.
5. Context grant application is durable and idempotent.
6. OAuth authorize no longer silently applies all platform/client contexts by default.
7. Invite creation and verification use one token format and one service.
8. Admin-created users either apply selected context grants or the UI stops implying they do.
9. Permission requests store explicit grant targets and approval writes through target-specific services.
10. Policy templates validate system-model grants before save and before apply.
11. Legacy client access tuples are audited and migration candidates are documented.
