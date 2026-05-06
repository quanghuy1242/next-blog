# Auth Space Access Control Implementation Plan

> Status: implementation-grade correction plan
>
> Date: 2026-05-06
>
> Scope: `/home/quanghuy1242/pjs/auther` access-control work, documented from `/home/quanghuy1242/pjs/next-blog`
>
> Source docs:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/auth-migration-backlog.md`
> - `docs/states/2026-05-05-auth-space-access-control-canonicalization.md`
> - `docs/states/2026-05-05-auth-r4-issues-md-remediation.md`
> - `docs/states/2026-05-05-auth-r4-cleanup-review.md`

---

## 1. Purpose

This document is the handoff plan for correcting the authorization-space access-control surface in `auther`.

The current implementation is a transitional merge of the old OAuth-client access-control UI into the new authorization-space entry point. It works for the immediate R4 need, but the responsibilities are mixed:

- the page is routed by authorization space
- the embedded component still thinks in OAuth-client terms
- API keys are physically stored through Better Auth's client-owned API-key system
- models are operationally owned by authorization spaces but still named with historical `client_<clientId>:` prefixes
- grants are partly space-aware and partly client-prefix-aware
- one of the four tabs belongs somewhere else

The goal is to turn `/admin/authorization-spaces/[id]/access` into the canonical resource-authorization management page without losing the important functionality from the old four-tab client access-control surface.

This document is intentionally detailed. It is meant to be handed to another engineer for implementation.

### 1.1 Aggressive Revision: Do Not Preserve Client-Centric Data As Target State

The earlier correction stance was too conservative around legacy model names and client-owned assumptions. The corrected target is stronger:

- active authorization-space models must not remain organized around OAuth-client prefixes
- `client_<clientId>:<model>` is migration input, not the long-term model identity
- client-owned tabs, client-scoped grants, and client-prefixed model filters must be removed from the authorization-space control surface
- compatibility may exist only as a short-lived adapter with explicit deletion criteria

Target model identity:

```text
authorizationSpaceId = <space id>
modelKey = book
entityType = book
```

If global uniqueness is required by the tuple/checking layer before all consumers are corrected, use a deterministic space-native namespace, not an OAuth-client namespace:

```text
authorizationSpaceId = <space id>
modelKey = book
entityType = space_<spaceSlugOrId>:book
```

The exact stored entity-type format should be decided in the migration design, but these rules are non-negotiable:

1. the stable owner is the authorization space, not a client
2. the canonical display/model key is not derived from a client id
3. legacy `client_<clientId>:` names are readable only through aliases during migration
4. new writes never create new client-prefixed model names
5. deletion/rename/update always require `authorizationSpaceId`

Temporary compatibility should use explicit alias data, for example:

```text
authorization_model_aliases
- id
- authorization_model_id
- authorization_space_id
- alias_entity_type          // client_<clientId>:book
- canonical_entity_type      // book or space_<spaceId>:book
- source                     // legacy_client_prefix | manual | import
- created_at
- retired_at
```

Consumers that currently pass `entityType = client_<clientId>:book` should be migrated to resolve by `(authorizationSpaceId, modelKey)` or by `authorizationModels.id`. The alias path exists to prevent downtime while Payload, webhook payloads, registration-context grants, API-key grants, and direct check-permission calls are updated.

Completion criteria for this plan must include:

- no active authorization-space model relies on an OAuth-client id for its canonical name
- no new tuple, context grant, API-key grant, or permission request writes a client-prefixed entity type
- all remaining `client_<clientId>:` references are alias rows, historical audit data, or manually approved holdouts
- old client access-control actions are not imported by any authorization-space route

---

## 2. Current State

### 2.1 Relevant Auther Files

Main authorization-space access page:

- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/page.tsx`
- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/actions.ts`
- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/space-grants-table.tsx`

Legacy client access actions reused by the space page:

- `/home/quanghuy1242/pjs/auther/src/app/admin/clients/[id]/access/actions.ts`

Legacy reusable client access-control UI:

- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/access-control.tsx`
- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/platform-access.tsx`
- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/scoped-permissions.tsx`
- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/api-key-management.tsx`
- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/data-model-editor.tsx`
- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/add-permission-modal.tsx`
- `/home/quanghuy1242/pjs/auther/src/components/admin/access-control/create-api-key-modal.tsx`

Space/client bridge:

- `/home/quanghuy1242/pjs/auther/src/lib/auth/authorization-space-access-client.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/auth/space-api-key-auth.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/services/api-key-permission-resolver.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/auth/permission-service.ts`

Data/storage:

- `/home/quanghuy1242/pjs/auther/src/db/app-schema.ts`
- `/home/quanghuy1242/pjs/auther/src/db/rebac-schema.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/repositories/authorization-space-repository.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/repositories/oauth-client-space-link-repository.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/repositories/authorization-model-repository.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/repositories/tuple-repository.ts`

### 2.2 Current Page Composition

`/admin/authorization-spaces/[id]/access/page.tsx` currently renders three broad sections:

1. `Model Ownership`
2. `Space Grants`
3. `Access Control`

The third section embeds the old `AccessControl` component after resolving one canonical backing OAuth client:

```ts
resolveAuthorizationSpaceAccessClient(space.id)
getClientAccessInitialData(accessClient.clientId, space.id)
<ClientProvider client={accessClient}>
  <AccessControl authorizationSpaceId={space.id} />
</ClientProvider>
```

The embedded `AccessControl` component renders four tabs:

1. `Platform Access`
2. `Scoped Permissions`
3. `API Keys`
4. `Data Model`

Those four tabs were designed for `/admin/clients/[id]/access`. The current route `/admin/clients/[id]/access` now redirects to the client's first linked authorization space or to `/admin/clients/[id]/spaces`.

### 2.3 Current Canonical Backing Client Rule

`resolveAuthorizationSpaceAccessClient(authorizationSpaceId)` currently chooses a single OAuth client for the space:

1. prefer a linked client whose id appears in assigned model names such as `client_<clientId>:book`
2. otherwise prefer a linked client with `accessMode === "full"`
3. otherwise use the first linked client

This was a necessary transitional fix because Better Auth API keys are still stored under OAuth-client metadata. The rule should stay in the short term, but it must become a private storage bridge, not the visible organizing principle of the access-control UI.

### 2.4 Current Schema Shape

Important tables:

- `authorization_spaces`
- `oauth_client_space_links`
- `authorization_models.authorization_space_id`
- `access_tuples.authorization_space_id`
- `oauth_client_metadata.allows_api_keys`
- Better Auth API keys with metadata:
  - `oauth_client_id`
  - `authorization_space_id` for newer space-scoped keys

Important tuple shapes:

```text
OAuth client management role:
entityType = oauth_client
entityId = <clientId>
relation = owner | admin | use
subjectType = user | group

Legacy client full access:
entityType = oauth_client
entityId = <clientId>
relation = full_access
subjectType = user | group | apikey

Authorization-space full access:
entityType = authorization_space
entityId = <authorizationSpaceId>
relation = full_access
subjectType = user | group | apikey
authorizationSpaceId = <authorizationSpaceId>

Scoped resource grant:
entityType = client_<clientId>:<resourceName>
entityTypeId = <authorization_models.id>
entityId = * | <resourceId>
relation = <model relation>
subjectType = user | group | apikey
authorizationSpaceId = <authorizationSpaceId>
```

### 2.5 Current Correct Pieces To Preserve

Do not throw away these parts:

- first-class `authorization_spaces`
- `oauth_client_space_links`
- canonical backing-client resolver as a temporary API-key bridge
- `authorization_models.authorization_space_id`
- `access_tuples.authorization_space_id`
- space full-access support in `PermissionService`
- API-key metadata `authorization_space_id`
- server-side relation validation before writing scoped grants
- Lua validation before storing tuple/model policies
- rollback behavior in `createClientApiKey` when tuple assignment fails
- hiding grant-projection targets from the space page through `showProjectionTargets={false}`

---

## 3. Target Product Shape

### 3.1 The Authorization Space Page Owns Resource Authorization

`/admin/authorization-spaces/[id]/access` should manage:

- models owned by this authorization space
- resource grants in this authorization space
- service accounts/API keys that access this authorization space
- full-space access grants for users, groups, and API keys

It should not manage:

- OAuth-client operator membership
- OAuth-client login policy
- OAuth-client registration context projection metadata
- generic platform policy templates

### 3.2 What Happens To The Four Existing Tabs

The old four tabs are important, but not all belong inside the authorization-space access page in their current form.

| Current tab | Keep on auth-space page? | Target replacement |
| --- | --- | --- |
| `Platform Access` | No | Move to global control-plane access management. Keep only a read-only "Linked Clients" summary on the space page. |
| `Scoped Permissions` | Yes, but rewrite | Rename to `Resource Grants`. Make it space-native and merge with the current top-level `Space Grants` section. |
| `API Keys` | Yes, but rewrite | Rename to `Service Accounts` or `API Keys`. Make it space-native; hide the backing-client implementation. |
| `Data Model` | Yes, but rewrite | Rename to `Models` or `Schema`. Make it space-native and merge with the current top-level `Model Ownership` section. |

### 3.3 Proposed Final Tabs

Replace the current page layout with one space-native tab set:

1. `Models`
2. `Resource Grants`
3. `Service Accounts`
4. `Linked Clients`

Tab responsibilities:

#### `Models`

Owns:

- assign existing model to this space
- remove model from this space
- create model in this space
- edit model relations and permissions
- rename model display name when safe
- delete model only when no tuples or registration-context grants depend on it

This replaces:

- top-level `Model Ownership`
- old `Data Model` tab

#### `Resource Grants`

Owns:

- grant user/group/API key scoped access to specific resource IDs or `*`
- grant user/group full authorization-space access
- revoke scoped grants
- revoke full-space access
- show grants with cursor pagination
- show conditions/Lua markers
- support bulk remove with warnings

This replaces:

- top-level `Space Grants`
- old `Scoped Permissions` tab

#### `Service Accounts`

Owns:

- enable/disable API keys for this authorization space
- create scoped API keys
- create full-space API keys
- list keys for this authorization space
- revoke keys
- edit scoped grants for a key

This replaces:

- old `API Keys` tab

#### `Linked Clients`

Owns:

- show which OAuth clients are linked to the space
- show each link mode: `login_only`, `can_trigger_contexts`, `full`
- show which client is currently the API-key storage bridge
- link to client details and client space-link management
- optionally allow platform admins to add/remove client links if the existing client space page is not enough
- do not expose user/group role grants for linked OAuth clients here

This replaces the visible need for:

- old `Platform Access` tab on the space page
- "Canonical Backing Client" card as the main UI

### 3.4 What Moves Out

Global platform access must not stay as a tab inside resource-space access.

The current `Platform Access` tab grants tuples on:

```text
entityType = oauth_client
entityId = <clientId>
relation = owner | admin | use
```

That tuple shape is a legacy client-local management/login-eligibility model. It is not resource access inside an authorization space, and it is also not the correct long-term platform access model.

The correct long-term model is global control-plane access through system authorization models such as:

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

entityType = groups
entityId = *
relation = viewer | editor | admin
```

The old OAuth-client `owner/admin/use` surface should be deprecated. If a product need remains for restricting which users can login through a specific OAuth client, model it as OAuth-client login eligibility, not platform access and not resource access. That can be a separate future capability; it should not be part of authorization-space access control.

For the broader correction plan, see `docs/auth-platform-registration-access-correction-plan.md`.

---

## 4. Main Technical Problem

The current code is space-routed but client-executed.

Examples:

- `AuthorizationSpaceAccessPage` imports many actions from `/app/admin/clients/[id]/access/actions.ts`.
- `AccessControl` requires a `ClientProvider`.
- `getCurrentUserAccessLevel(clientId)` decides whether the current user can edit space models.
- `getPlatformAccessList(clientId)` still reads `oauth_client` operator tuples.
- `getAuthorizationModels(clientId, authorizationSpaceId)` filters by both space id and `client_<clientId>:` prefix.
- `grantScopedPermission(clientId, ..., authorizationSpaceId)` writes a space grant but still needs a client id to construct or interpret the entity type.
- `deleteEntityTypeModel(clientId, entityTypeName)` has no `authorizationSpaceId`, so deletion from a space-routed UI can accidentally operate on client-prefixed models outside the intended space.
- `checkScopedPermissionsForUser(clientId, ...)` and cascade removal are prefix-based, not space-id-based.
- API key list behavior includes legacy untagged keys when called with `authorizationSpaceId`.

The fix is not only a UI rename. The action/service layer needs to become authorization-space-native.

---

## 5. Implementation Strategy

### 5.1 Add A Space-Native Service Layer First

Create a service that expresses the real resource boundary:

- `/home/quanghuy1242/pjs/auther/src/lib/auth/authorization-space-access-service.ts`

The service should not import React or Next server actions. It should be unit-testable with repository dependencies.

Suggested exports:

```ts
export interface AuthorizationSpaceAccessInitialData {
  space: AuthorizationSpaceEntity;
  linkedClients: LinkedClientSummary[];
  backingClient: BackingClientSummary | null;
  canManageModels: boolean;
  canManageGrants: boolean;
  canManageApiKeys: boolean;
  models: SpaceModelSummary[];
  grantsPage: SpaceGrantPage;
  apiKeys: SpaceApiKeySummary[];
}

export class AuthorizationSpaceAccessService {
  getInitialData(spaceId: string, actorUserId: string): Promise<AuthorizationSpaceAccessInitialData>;
  listModels(spaceId: string): Promise<SpaceModelSummary[]>;
  createModel(spaceId: string, input: CreateSpaceModelInput): Promise<SpaceModelSummary>;
  updateModel(spaceId: string, modelId: string, input: UpdateSpaceModelInput): Promise<SpaceModelSummary>;
  renameModel(spaceId: string, modelId: string, newName: string): Promise<void>;
  deleteModel(spaceId: string, modelId: string): Promise<void>;
  listGrants(spaceId: string, cursor?: string, limit?: number): Promise<SpaceGrantPage>;
  grantScoped(spaceId: string, input: GrantScopedInput): Promise<Tuple>;
  grantFullAccess(spaceId: string, input: GrantFullAccessInput): Promise<Tuple>;
  revokeGrant(spaceId: string, tupleId: string): Promise<void>;
  listApiKeys(spaceId: string): Promise<SpaceApiKeySummary[]>;
  createApiKey(spaceId: string, input: CreateSpaceApiKeyInput): Promise<CreateApiKeyResult>;
  revokeApiKey(spaceId: string, keyId: string): Promise<void>;
}
```

The Next server actions should call this service instead of the old client actions.

### 5.2 Expand Space Actions

Replace the thin current file:

- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/actions.ts`

with complete space-native actions:

```ts
getAuthorizationSpaceAccessInitialData(spaceId)
createSpaceModel(formData | input)
updateSpaceModel(input)
renameSpaceModel(input)
deleteSpaceModel(input)
grantSpaceScopedPermission(input)
grantSpaceFullAccess(input)
revokeSpaceGrant(input)
listSpaceApiKeys(spaceId)
createSpaceApiKey(input)
revokeSpaceApiKey(input)
toggleSpaceApiKeys(input)
```

Rules:

- every action accepts `spaceId`
- every action loads the space and rejects disabled/missing spaces
- every action validates that the model/tuple/API key belongs to that `spaceId`
- no action trusts `clientId` from the browser for resource authorization
- the backing client is resolved server-side only when needed for Better Auth API-key storage
- all writes revalidate `/admin/authorization-spaces/${spaceId}/access`

### 5.3 Stop Importing Client Access Actions From The Space Page

Remove these imports from:

- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/page.tsx`

Current imported client actions to remove:

```ts
getAuthorizationModels
getClientApiKeys
getClientMetadata
getCurrentUserAccessLevel
getGrantProjectionClientOptions
getPlatformAccessList
getScopedPermissions
```

The page should instead call one space action or service read:

```ts
const initialData = await getAuthorizationSpaceAccessInitialData(id);
```

### 5.4 Split Or Replace The Old `AccessControl` Component

The current `AccessControl` component is too client-shaped. There are two safe implementation options.

Preferred option:

- create new space-native components under:
  - `/home/quanghuy1242/pjs/auther/src/components/admin/authorization-space-access/`

Suggested files:

```text
authorization-space-access.tsx
models-tab.tsx
resource-grants-tab.tsx
service-accounts-tab.tsx
linked-clients-tab.tsx
grant-modal.tsx
api-key-modal.tsx
model-editor.tsx
types.ts
```

Fallback option:

- refactor old access-control components into dumb view components and inject handlers/data from either client or space adapters.

Do not keep the current `ClientProvider` requirement for the authorization-space page.

### 5.5 Keep The Backing Client Only As A Server-Side Bridge

The canonical backing client is still needed because Better Auth's API-key API stores keys under client metadata.

Short-term rule:

- `resolveAuthorizationSpaceAccessClient(spaceId)` remains
- only space server actions call it
- the UI may show a small technical note in `Linked Clients`
- API-key create/list/revoke never accepts arbitrary client id from the browser

Long-term rule:

- when API keys can be stored against `authorization_space` directly, remove the backing-client dependency.

---

## 6. Detailed Tab Plans

## 6.1 `Models` Tab

### 6.1.1 Current Problems

Current model editing comes from two places:

- top-level `Model Ownership` card
- old `Data Model` tab in `AccessControl`

Problems:

- duplicate model management surfaces
- `DataModelEditor` edits models through `clientId`
- model list filters by `authorizationSpaceId` and `client_<clientId>:` prefix
- model display names strip the prefix, but writes reconstruct the prefixed name
- deletion path does not receive `authorizationSpaceId`
- rename path does not receive `authorizationSpaceId`
- if a space contains models from multiple historical clients, the current backing-client filter can hide models

### 6.1.2 Target Behavior

The `Models` tab shows all models where:

```ts
authorizationModels.authorizationSpaceId === spaceId
```

It must not filter by backing client.

The UI should show:

- display name: `book`
- canonical entity type: `book` or `space_<spaceId>:book`
- legacy aliases: `client_DXJSQZpOEXTzlskMNQUERHdrKhTbTQrq:book`
- model id
- relation count
- permission count
- warning badge when the model still has active legacy client-prefixed aliases

For current Payload data, do not leave client-prefixed entity types as the target state. Payload and existing permission checks may still depend on stable names like:

```text
client_DXJSQZpOEXTzlskMNQUERHdrKhTbTQrq:book
```

Those names should be migrated through an alias-backed compatibility phase:

1. create canonical space-native model identity
2. create alias from old client-prefixed entity type to the canonical model
3. update read/check paths to resolve aliases
4. update write paths to emit canonical entity types only
5. backfill tuples, API-key grants, registration-context grants, webhooks, and Payload integration config
6. retire the alias after no runtime consumer uses it

### 6.1.3 Implementation Tasks

Add repository helpers:

- `authorizationModelRepository.findByAuthorizationSpace(spaceId)`
- `authorizationModelRepository.findBySpaceAndId(spaceId, modelId)`
- `authorizationModelRepository.findBySpaceAndDisplayName(spaceId, displayName)`
- `authorizationModelRepository.updateDefinitionForSpace(spaceId, modelId, definition)`
- `authorizationModelRepository.renameInSpace(spaceId, modelId, newDisplayName, namingStrategy)`
- `authorizationModelRepository.deleteFromSpace(spaceId, modelId)`

Keep existing helpers temporarily for client pages:

- `findAllForClient`
- `upsertEntityTypeForClient`
- `deleteEntityTypeForClient`

Add display-name helper:

```ts
function getSpaceModelDisplayName(entityType: string): string {
  return entityType.includes(":")
    ? entityType.slice(entityType.indexOf(":") + 1)
    : entityType;
}
```

Add stored-name strategy:

```ts
type SpaceModelNamingStrategy =
  | { kind: "preserve_legacy_prefix"; backingClientId: string }
  | { kind: "space_native" };
```

For this migration, use `preserve_legacy_prefix` when creating new models in a space that already has prefixed Payload models. Do not mix native and prefixed names in the same live Payload space until Payload projection and check-permission callers are audited.

### 6.1.4 Save Flow

When saving model JSON/visual changes:

1. parse and schema-validate JSON
2. validate every relation name:
   - non-empty
   - unique inside model
   - no `:` unless explicitly allowed
   - no control characters
3. validate every permission:
   - non-empty name
   - points to an existing relation
   - Lua policy syntax valid if `policyEngine === "lua"`
4. load existing model by `spaceId + modelId`
5. pre-validate relation removal:
   - count tuples by `entityTypeId + relation`, not only `entityType + relation`
   - count registration context grants by `entityTypeId + relation`
6. update only that model
7. save ABAC policy versions for changed Lua policies
8. revalidate the page

### 6.1.5 Rename Flow

Rename should be explicit, not inferred by "one removed and one added" from a JSON blob.

Current `AccessControl.handleSaveModel` uses a heuristic:

```ts
if exactly one type was removed and one added, treat it as rename
```

Do not use that for space-native model editing. It can misinterpret delete+create as a rename.

Use a deliberate rename action:

```ts
renameSpaceModel({
  spaceId,
  modelId,
  newDisplayName
})
```

Server validation:

- model must belong to `spaceId`
- new display name must not collide with another model in the same space
- if preserving legacy prefix, update from `client_<backingClientId>:old` to `client_<backingClientId>:new`
- update denormalized `access_tuples.entity_type` for tuples with this `entityTypeId`
- do not change `access_tuples.entity_type_id`

### 6.1.6 Delete Flow

Deletion must be blocked if any of these exist:

- tuples with `entityTypeId === model.id`
- tuples with `entityType === model.entityType` for legacy rows
- registration context grants referencing `model.id`
- API key scoped tuples referencing the model

Error message must say what blocks deletion:

```text
Cannot delete model 'book': 12 grants still reference it. Revoke those grants first.
```

### 6.1.7 Edge Cases

- Space has zero models.
- Space has disabled status.
- Space has models from two historical client prefixes.
- Two models in one space have the same display name after stripping prefix.
- Existing tuples have `entityTypeId = null` but matching `entityType`.
- Existing tuples have `authorizationSpaceId = null` but model now belongs to the space.
- Relation is removed while tuples still use it.
- Permission is removed while application code still calls it.
- Lua policy syntax is valid but references unavailable context fields.
- Rename succeeds for model but tuple string backfill fails.
- Concurrent saves overwrite each other.

### 6.1.8 Tests

Add or update tests in `/home/quanghuy1242/pjs/auther/tests/`:

- `authorization-space-model-actions.test.ts`
- `authorization-model-repository.space.test.ts`

Test cases:

- list all models for a space regardless of backing client prefix
- reject editing a model from another space
- reject relation removal with active tuples
- reject duplicate display names in a space
- rename updates model and denormalized tuple string
- delete blocked by tuple reference
- delete blocked by registration-context grant
- space with prefixed and native model names displays both safely

---

## 6.2 `Resource Grants` Tab

### 6.2.1 Current Problems

Resource grants are split between:

- current top-level `Space Grants`
- old `Scoped Permissions` tab

Problems:

- duplicate grant creation paths
- top-level `Space Grants` supports user/group but not API keys
- old `Scoped Permissions` supports API keys but is client-action-backed
- full-access display says "client-wide" in several places
- `checkScopedPermissionsForUser` is client-prefix-based and ignores `authorizationSpaceId`
- cascade revoke can delete grants from another space if they share a client prefix
- grant listing only shows first 200 tuples

### 6.2.2 Target Behavior

The `Resource Grants` tab is the only place for space resource grants.

It should support subjects:

- user
- group
- API key

It should support grant modes:

- scoped relation on all resources: `entityId = "*"`
- scoped relation on one or more specific resource IDs
- scoped relation with Lua condition
- full authorization-space access

Full access must use:

```text
entityType = authorization_space
entityId = <spaceId>
relation = full_access
authorizationSpaceId = <spaceId>
```

It must not create `oauth_client full_access` when the UI is operating inside a space.

### 6.2.3 Implementation Tasks

Add service methods:

```ts
grantSpaceScopedPermission(spaceId, input)
grantSpaceFullAccess(spaceId, input)
revokeSpaceGrant(spaceId, tupleId)
listSpaceGrants(spaceId, { cursor, limit, filters })
checkSpaceScopedPermissionsForSubject(spaceId, subjectType, subjectId)
```

Add repository helpers if missing:

- `tupleRepository.findByAuthorizationSpacePaginated({ authorizationSpaceId, cursor, limit })`
- `tupleRepository.countByAuthorizationSpaceAndSubject(spaceId, subjectType, subjectId)`
- `tupleRepository.deleteByAuthorizationSpaceAndSubject(spaceId, subjectType, subjectId)`
- `tupleRepository.findFullAccessBySpace(spaceId)`
- `tupleRepository.findExactInSpace(spaceId, tupleShape)`

Grant validation:

1. load `space`
2. reject if missing or disabled
3. load model by `spaceId + modelId` or `spaceId + displayName`
4. verify relation exists in `model.definition.relations`
5. verify subject exists:
   - user id exists
   - group id exists
   - API key exists and is tagged for this space
6. if condition present, validate Lua syntax
7. write tuple with:
   - `entityType = model.entityType`
   - `entityTypeId = model.id`
   - `authorizationSpaceId = spaceId`
8. use idempotent create where appropriate
9. if a duplicate exists and condition changed, update condition deliberately

### 6.2.4 Remove The Duplicate Top-Level Space Grants Section

After `Resource Grants` tab exists, delete the separate `Space Grants` card from:

- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/page.tsx`

Move any useful table behavior from:

- `/home/quanghuy1242/pjs/auther/src/app/admin/authorization-spaces/[id]/access/space-grants-table.tsx`

into the new tab.

### 6.2.5 API Key Subjects

When the subject is `apikey`, validate key ownership:

- key metadata `authorization_space_id === spaceId`
- key metadata `oauth_client_id === resolvedBackingClient.clientId`
- key is active/not revoked

Do not allow assigning a space grant to:

- an API key from another space
- an API key from another OAuth client
- an untagged legacy key unless the migration mode explicitly allows it

### 6.2.6 Full Access Display

Replace copy:

- "client-wide full access"
- "Full client access"

with:

- "full space access"
- "full authorization-space access"

The tuple function names can remain temporarily if internal, but exported space actions and UI labels should not use "client-wide".

### 6.2.7 Pagination And Filters

The current page says:

```text
Showing the first 200 grants in this authorization space.
```

Replace this with real pagination:

- default limit: 50 or 100
- cursor by `createdAt + id`
- filters:
  - model
  - relation
  - subject type
  - subject search
  - resource id
  - full access only
  - conditioned only

### 6.2.8 Edge Cases

- Model has no relations.
- Grant is created for `entityId = ""`; normalize to `*`.
- Specific ID input contains comma-separated IDs with spaces.
- Duplicate grant exists with same tuple and no condition.
- Duplicate grant exists but new condition differs.
- Condition is whitespace only.
- Condition is syntactically valid but always false.
- User/group/API key is deleted after grant exists.
- Group contains users and API keys.
- Full-space access and scoped grants coexist for same subject.
- Revoking scoped grant should not revoke full-space access.
- Revoking full-space access should not delete scoped grants unless explicit.
- Tuple has `authorizationSpaceId = null` but model belongs to the space.
- Tuple has stale `entityType` string after model rename.
- Current actor can view the page but should not manage grants.

### 6.2.9 Tests

Add tests:

- `authorization-space-grants-actions.test.ts`
- `permission-service.authorization-space-full-access.test.ts`

Test cases:

- grant user scoped access in a space
- grant group scoped access in a space
- grant API key scoped access in a space
- reject model from another space
- reject API key from another space
- full-space access permits model resource access
- full-space access does not permit unrelated space model access
- duplicate grant is idempotent
- duplicate grant condition update works
- cascade delete by subject only deletes tuples in the requested space

---

## 6.3 `Service Accounts` / `API Keys` Tab

### 6.3.1 Current Problems

API keys are the hardest part because Better Auth stores them in client scope.

Current behavior:

- `getClientApiKeys(clientId, authorizationSpaceId)` lists keys where:
  - `metadata.oauth_client_id === clientId`
  - and either:
    - `metadata.authorization_space_id === authorizationSpaceId`
    - or `metadata.authorization_space_id === undefined`
- this intentionally keeps legacy untagged keys visible during migration
- `createClientApiKey` writes `metadata.oauth_client_id`
- when space id is passed, it also writes `metadata.authorization_space_id`
- full-space API keys create `authorization_space full_access` tuples

Problems:

- untagged legacy keys can look like space keys
- enabling API keys is stored in `oauth_client_metadata.allows_api_keys`, not per space
- UI labels still mention client in some places
- API key revoke only validates client metadata, not space metadata
- API key management is mixed with scoped grants in the old component

### 6.3.2 Target Behavior

The space tab should present API keys as service accounts for the authorization space.

Server-side storage bridge:

- backing client is resolved internally
- Better Auth API key receives:

```ts
metadata: {
  oauth_client_id: backingClientId,
  authorization_space_id: spaceId,
  access_level: actorLevel
}
```

Space full-access key:

```text
entityType = authorization_space
entityId = <spaceId>
relation = full_access
subjectType = apikey
subjectId = <keyId>
authorizationSpaceId = <spaceId>
```

Space scoped key:

```text
entityType = <model.entityType>
entityTypeId = <model.id>
entityId = *
relation = <relation>
subjectType = apikey
subjectId = <keyId>
authorizationSpaceId = <spaceId>
```

### 6.3.3 API Key Enablement

Do not use client-level `oauth_client_metadata.allows_api_keys` as the final source of truth for a space.

Add one of these:

Preferred:

- `authorization_spaces.allows_api_keys boolean not null default false`

Alternative:

- `authorization_space_metadata` table with `allowsApiKeys`

Implementation tasks:

1. add schema field/table
2. write migration
3. update repository
4. update seed/backfill for `payload-content`
5. keep reading client metadata as fallback during migration only
6. after backfill, remove client-metadata dependency from the space page

### 6.3.4 Listing Keys

Space-native list should default to strict filtering:

```ts
key.metadata.oauth_client_id === backingClientId
key.metadata.authorization_space_id === spaceId
```

Legacy untagged keys should not appear in the normal table.

If needed, add a separate collapsible migration panel:

```text
Legacy keys from the backing client without authorization_space_id
```

This panel should be read-only by default and offer an explicit "attach to this space" action only for platform admins.

### 6.3.5 Creating Keys

Flow:

1. actor submits key name, expiry, access mode, scoped permission selections
2. server loads `space`
3. server rejects if `space.enabled === false`
4. server resolves backing client
5. server rejects if no backing client
6. server checks actor can manage API keys for the space
7. server validates scoped permission selections against models in the space
8. server creates Better Auth API key with metadata
9. server creates ReBAC tuples
10. if tuple creation fails:
    - delete tuples by subject
    - revoke/delete Better Auth API key
    - return rollback-specific error

This preserves the current rollback behavior from `createClientApiKey`.

### 6.3.6 Revoking Keys

Revoke flow:

1. list Better Auth keys
2. find key by id
3. verify:
   - `metadata.authorization_space_id === spaceId`
   - `metadata.oauth_client_id === backingClientId`
4. verify actor can manage API keys for this space
5. delete/revoke key through Better Auth
6. delete tuples where:
   - `subjectType = apikey`
   - `subjectId = keyId`
   - `authorizationSpaceId = spaceId`
7. do not delete same API key subject tuples in another space unless the key is not supposed to be cross-space

### 6.3.7 Edge Cases

- No backing client exists.
- Backing client changes because model ownership changes.
- Existing keys are attached to the old backing client.
- API keys are enabled on old client metadata but disabled on space metadata.
- Space is disabled after keys exist.
- Better Auth key exists but tuples were not created.
- Tuples exist but Better Auth key was deleted.
- Revocation succeeds in Better Auth but tuple cleanup fails.
- Tuple cleanup succeeds but Better Auth revocation fails.
- Key is full-space access and user tries to add scoped grants.
- Key is scoped and all scoped permissions are removed.
- Legacy untagged key is visible during migration and could be confused with a space key.
- Two authorization spaces share one backing client.
- API key metadata contains malformed values.

### 6.3.8 Tests

Add tests:

- `authorization-space-api-key-actions.test.ts`
- extend `client-api-key-actions.full-access.test.ts`
- extend `api-key-permission-resolver.client-full-access.test.ts`

Test cases:

- create scoped space API key writes key metadata and scoped tuples
- create full-space API key writes `authorization_space full_access`
- reject key creation when no backing client exists
- reject scoped permission for model outside the space
- list excludes legacy untagged keys by default
- revoke validates `authorization_space_id`
- rollback deletes key if tuple creation fails
- full-space API key can access resources in space
- full-space API key cannot access another space

---

## 6.4 `Linked Clients` Tab

### 6.4.1 Purpose

OAuth clients still matter, but they should be shown as clients linked to the space, not as the thing being granted resource permissions.

The tab should answer:

- which apps can participate in this space?
- which apps can trigger registration contexts?
- which app is the current API-key storage bridge?
- where do I manage OAuth client operator access?

### 6.4.2 Target Fields

Show for each linked client:

- client name
- client id
- client type
- link access mode
- trusted status if available
- whether it owns any legacy-prefixed models in this space
- model count
- whether it is the current backing client
- links:
  - client detail
  - client spaces
  - client operator access page

### 6.4.3 Link Mode Semantics

Keep current modes:

```ts
type ClientSpaceAccessMode = "login_only" | "can_trigger_contexts" | "full";
```

Do not treat `full` as resource full access for users or API keys. It is a client-to-space participation mode.

Display copy should make this explicit:

- `login_only`: client can request login/token flows for this space
- `can_trigger_contexts`: client can trigger registration-context grants for this space
- `full`: client can use all currently implemented client-to-space capabilities

### 6.4.4 What To Do With Platform Access

The old `Platform Access` tab should not move here as editable controls and should not be preserved as a client operator page in the same shape.

Implementation:

1. remove editable `PlatformAccess` from authorization-space access
2. keep `Linked Clients` focused on OAuth client to authorization-space links
3. move true platform membership/roles to a global access surface
4. deprecate `oauth_client owner/admin/use` as a platform access mechanism
5. keep OAuth client login restrictions separate from platform access

### 6.4.5 Edge Cases

- Space has no linked clients.
- Space has several linked clients and no models.
- Space has models but their model-owner client is not linked.
- Backing client selected by fallback instead of model owner.
- Backing client is disabled/deleted.
- Link mode is `login_only` but user expects API-key management.
- Removing a link would orphan API keys.
- Removing a link would break resource-token issuance for a client.
- A user has legacy `oauth_client owner/admin/use` but no global `clients:update` permission.
- A user has global `clients:update` permission but no legacy OAuth-client tuple.

### 6.4.6 Tests

Add tests:

- `authorization-space-linked-clients.test.ts`
- `authorization-space-access-client.test.ts`

Test cases:

- resolver prefers model owner
- resolver falls back to full link
- resolver falls back to first link
- unlinked model-owner client is reported as warning
- linked clients summary returns correct model counts
- cannot unlink backing client while active keys exist unless force/migration path is explicit

---

## 7. Permission Model For Managing The Space

### 7.1 Current State

The space page is guarded by:

```ts
await guards.platform.admin();
```

But the embedded `AccessControl` component asks client actions for:

```ts
getCurrentUserAccessLevel(clientId)
```

That means a platform admin can reach the page but may be blocked by client-level owner/admin checks inside the tabs.

### 7.2 Target Rule For This Iteration

For the first correction pass, keep the page platform-admin-only:

```ts
await guards.platform.admin();
```

Then make all space actions use the same platform-admin requirement or a new space management guard.

Do not use OAuth-client owner/admin tuples to decide whether the actor can manage space models, resource grants, or space API keys.

### 7.3 Future Space Delegation

If non-platform-admins need to manage spaces, add explicit space management relations.

Do not reuse `authorization_space full_access` for management rights. That tuple means resource access, not admin permission.

Add separate management model, for example:

```text
entityType = authorization_space_admin
entityId = <spaceId>
relation = owner | admin | grant_manager | model_manager | api_key_manager | viewer
```

or define `authorization_space` management relations distinct from `full_access`:

```text
relation = owner | admin | manage_models | manage_grants | manage_api_keys | view
```

If using the same `authorization_space` entity type, keep a clear convention:

- `full_access` = resource access inside the space
- `owner/admin/manage_*` = management access to the space itself

### 7.4 Edge Cases

- Platform admin has no client owner tuple.
- Client owner is not allowed to manage the space.
- Space manager should manage grants but not models.
- Space manager should manage API keys but not client links.
- Full-space resource subject should not become a space admin.

---

## 8. Migration And Backfill

### 8.1 Required Data Audit

Before changing behavior, run an audit script in `auther` that reports:

1. spaces
2. linked clients per space
3. models per space
4. models with `authorizationSpaceId = null`
5. tuples with `authorizationSpaceId = null` but model belongs to a space
6. tuples with `entityTypeId = null` but matching a known model entity type
7. API keys with `oauth_client_id` but no `authorization_space_id`
8. API keys with `authorization_space_id` but no matching client-space link
9. spaces with more than one legacy model-owner client prefix
10. spaces with no backing client

Suggested script:

- `/home/quanghuy1242/pjs/auther/scripts/audit-authorization-space-access.ts`

### 8.2 Backfill Rules

For tuples:

- if `access_tuples.entity_type_id` points to a model with `authorizationSpaceId`, set tuple `authorizationSpaceId`
- else if `access_tuples.entity_type` matches exactly one model with `authorizationSpaceId`, set tuple `entityTypeId` and `authorizationSpaceId`
- else leave untouched and report ambiguity

For API keys:

- if key belongs to the canonical backing client and all its tuples are in exactly one space, set `metadata.authorization_space_id`
- if key has no tuples, do not auto-attach without operator decision
- if key has tuples in multiple spaces, leave as legacy and report

For models:

- create canonical space-native model identities for every active authorization-space model
- create alias rows for every legacy `client_<clientId>:` entity type
- only assign missing `authorizationSpaceId` when ownership is obvious
- do not rewrite ambiguous models automatically; report them for operator mapping
- after alias resolution is deployed, backfill tuple and grant writers to canonical names

### 8.3 Rollback

Schema additions should be additive.

Rollback expectations:

- if new UI fails, keep old client actions intact only behind a legacy/admin-only route
- keep `/admin/clients/[id]/spaces` links
- preserve existing tuples and API key metadata
- preserve alias rows so old runtime checks can still resolve
- do not continue creating client-prefix model names after the migration flag is enabled
- do not delete `grantProjectionClientIds` until registration-context migration is complete, but freeze new writes to it

---

## 9. Implementation Backlog

## R5-0. Normalize Model Identity Away From Clients

This should happen before the UI is treated as corrected. A polished space UI over client-prefixed model identity would cement the wrong model.

### R5-0A Add Model Alias Schema

Files:

- `src/db/rebac-schema.ts`
- `src/lib/repositories/authorization-model-repository.ts`
- migration file

Tasks:

1. add `authorization_model_aliases`
2. enforce alias uniqueness by `authorizationSpaceId + aliasEntityType`
3. expose lookup by canonical model id
4. expose lookup by legacy entity type
5. add `retiredAt` so aliases can be drained safely

Acceptance:

- an old `client_<clientId>:book` lookup can resolve to the canonical `book` model in the correct space
- an alias cannot point across spaces
- retired aliases no longer satisfy new writes

### R5-0B Freeze Client-Prefixed Model Writes

Files:

- `src/app/admin/clients/[id]/access/actions.ts`
- `src/app/admin/authorization-spaces/[id]/access/actions.ts`
- `src/lib/repositories/authorization-model-repository.ts`

Tasks:

1. block new `client_<clientId>:` model creation from space routes
2. mark old client model-write actions as legacy only
3. add server-side validation that requires `authorizationSpaceId` for model create/update/delete
4. add audit logging for any remaining client-prefixed write attempt

Acceptance:

- no corrected route can create a client-prefixed model
- the only accepted client-prefixed model references are alias reads during migration

### R5-0C Backfill Canonical Models And Consumers

Files:

- `scripts/audit-authorization-space-access.ts`
- `scripts/migrate-space-model-identities.ts`
- Payload/auth integration config files
- permission-check helpers
- webhook event builders

Tasks:

1. generate mapping from legacy entity type to canonical model
2. create aliases for all unambiguous legacy models
3. update permission checks to prefer `authorizationModelId` or `(authorizationSpaceId, modelKey)`
4. update tuple/grant writers to emit canonical names
5. update webhook payloads to include canonical model id and legacy alias only as compatibility metadata
6. report unresolved models with exact owner/client/space candidates

Acceptance:

- old checks still pass through alias resolution
- new writes use canonical model identity
- unresolved mappings are visible before destructive cleanup

## R5-A. Stabilize Space-Native Reads

### R5-A1 Add Space Access Service

Files:

- `src/lib/auth/authorization-space-access-service.ts`
- `src/lib/repositories/authorization-model-repository.ts`
- `src/lib/repositories/tuple-repository.ts`

Tasks:

1. add `AuthorizationSpaceAccessService`
2. add dependency injection for tests
3. add model list by space
4. add grant list by space with pagination
5. add strict API-key list by space
6. add linked-client summary
7. expose backing-client summary but keep it implementation-labeled

Acceptance:

- service returns all space models even if model prefixes come from multiple clients
- service does not require browser-provided `clientId`
- service does not import old client access actions

### R5-A2 Replace Page Data Loading

File:

- `src/app/admin/authorization-spaces/[id]/access/page.tsx`

Tasks:

1. replace manual Promise fan-out with `getAuthorizationSpaceAccessInitialData`
2. remove imports from `/app/admin/clients/[id]/access/actions`
3. remove `ClientProvider`
4. remove embedded `AccessControl`
5. render new space-native tab shell

Acceptance:

- page loads with only `spaceId`
- page still shows models, grants, API keys, linked clients
- no client action is called by the page

## R5-B. Correct Models Tab

### R5-B1 Build Space Models Components

Files:

- `src/components/admin/authorization-space-access/models-tab.tsx`
- `src/components/admin/authorization-space-access/model-editor.tsx`
- reuse or adapt `data-model-editor.tsx`

Tasks:

1. show models assigned to the space
2. show available unassigned models
3. support assign/remove
4. support create/edit model
5. support explicit rename
6. support delete with dependency errors

Acceptance:

- model list is not filtered by backing client
- legacy-prefixed models display readable names
- relation removal with tuples is blocked server-side

### R5-B2 Add Space Model Actions

File:

- `src/app/admin/authorization-spaces/[id]/access/actions.ts`

Tasks:

1. create `createSpaceModel`
2. create `updateSpaceModel`
3. create `renameSpaceModel`
4. create `deleteSpaceModel`
5. create `assignSpaceModel`
6. ensure all actions validate `spaceId`

Acceptance:

- cannot mutate a model outside the requested space
- tuple metadata remains consistent after rename

## R5-C. Correct Resource Grants Tab

### R5-C1 Merge Space Grants And Scoped Permissions

Files:

- `src/components/admin/authorization-space-access/resource-grants-tab.tsx`
- `src/components/admin/authorization-space-access/grant-modal.tsx`
- retire or adapt `space-grants-table.tsx`

Tasks:

1. support user/group/API-key subject selection
2. support full-space access
3. support scoped `*`
4. support specific IDs
5. support Lua condition
6. support filters and pagination
7. remove top-level `Space Grants` card

Acceptance:

- only one grants UI exists on the page
- all writes stamp `authorizationSpaceId`
- full access uses `authorization_space`, not `oauth_client`

### R5-C2 Add Space Grant Actions

File:

- `src/app/admin/authorization-spaces/[id]/access/actions.ts`

Tasks:

1. add `grantSpaceScopedPermission`
2. add `grantSpaceFullAccess`
3. add `revokeSpaceGrant`
4. add `checkSpaceScopedPermissionsForSubject`
5. add strict API-key subject validation

Acceptance:

- rejecting cross-space models is covered by tests
- rejecting cross-space API keys is covered by tests
- cascade deletes are scoped to `spaceId`

## R5-D. Correct Service Accounts/API Keys Tab

### R5-D1 Add Space API-Key Metadata

Files:

- `src/db/app-schema.ts`
- `drizzle/*`
- `src/lib/repositories/authorization-space-repository.ts`

Tasks:

1. add `allowsApiKeys` to `authorization_spaces` or create metadata table
2. migrate existing Payload space based on current backing-client metadata
3. read space setting in space access service
4. stop treating client metadata as canonical for space page

Acceptance:

- API keys can be enabled/disabled per space
- toggling one space does not toggle another space sharing the backing client

### R5-D2 Add Strict Space API-Key Actions

Files:

- `src/app/admin/authorization-spaces/[id]/access/actions.ts`
- `src/lib/auth/authorization-space-access-service.ts`

Tasks:

1. create `listSpaceApiKeys`
2. create `createSpaceApiKey`
3. create `revokeSpaceApiKey`
4. create `toggleSpaceApiKeys`
5. preserve rollback behavior
6. exclude legacy untagged keys from normal list

Acceptance:

- created key has `authorization_space_id`
- revoke refuses key from another space
- full-space key works through `PermissionService`

### R5-D3 Build Service Accounts UI

Files:

- `src/components/admin/authorization-space-access/service-accounts-tab.tsx`
- `src/components/admin/authorization-space-access/api-key-modal.tsx`

Tasks:

1. rename labels from "client" to "authorization space"
2. show full-space access clearly
3. manage scoped key permissions through `Resource Grants` action path
4. show migration panel for legacy untagged keys if needed

Acceptance:

- backing client id is not required to understand the UI
- no "client-wide" copy appears in this tab

## R5-E. Move Platform Access Out

### R5-E1 Move Platform Access To Global Control Plane

Files:

- `src/app/admin/access/page.tsx`
- `src/app/admin/access/actions.ts`
- `src/app/admin/access/access-client.tsx`
- `src/lib/auth/platform-guard.ts`
- `src/lib/auth/system-models.ts`

Tasks:

1. remove editable `PlatformAccess` from auth-space access
2. do not recreate it as client-owned operator management
3. create or revise a global platform access section that grants system-model permissions
4. use tuples such as `platform:*:admin`, `users:*:admin`, `clients:*:admin`
5. mark `oauth_client owner/admin/use` as legacy compatibility state
6. add migration/audit reporting for legacy OAuth-client access tuples

Acceptance:

- authorization-space page no longer has editable `Platform Access`
- platform access is managed globally
- no new UI encourages `oauth_client owner/admin/use` as the platform access model

### R5-E2 Update Client Access Redirect

File:

- `src/app/admin/clients/[id]/access/page.tsx`

Tasks:

1. keep this route from becoming a client-owned platform-access surface again
2. route users to the client space links page or the global access page depending on intent
3. if legacy OAuth-client login eligibility must remain visible, label it as login eligibility, not platform access

Acceptance:

- client access semantics are clear
- resource access, OAuth client login eligibility, and global platform access are not conflated

## R5-F. Linked Clients Tab

### R5-F1 Build Linked Clients Summary

Files:

- `src/components/admin/authorization-space-access/linked-clients-tab.tsx`
- `src/lib/auth/authorization-space-access-service.ts`

Tasks:

1. list linked clients
2. show access mode
3. show model counts
4. show backing-client badge
5. show warnings
6. link to client detail and client-space link management

Acceptance:

- no linked client case is actionable
- multiple linked clients are understandable
- backing-client fallback reason is visible but not central

## R5-G. Tests And Verification

### R5-G1 Unit Tests

Add:

- `tests/authorization-space-access-service.test.ts`
- `tests/authorization-space-model-actions.test.ts`
- `tests/authorization-space-grants-actions.test.ts`
- `tests/authorization-space-api-key-actions.test.ts`
- `tests/authorization-space-access-client.test.ts`

Minimum coverage:

- model owner resolution
- model list by space
- grant create/revoke by space
- full-space access permission check
- API-key create/list/revoke by space
- cross-space rejection
- legacy data behavior

### R5-G2 Typecheck/Lint

Run in `/home/quanghuy1242/pjs/auther`:

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm exec tsx --test tests/*.test.ts
```

### R5-G3 Manual Verification

Manual scenarios:

1. open `payload-content` space access page
2. verify models show `book` while preserving stored legacy entity type
3. create user scoped grant for all books
4. create user scoped grant for one book id
5. create user full-space grant
6. create scoped API key
7. create full-space API key
8. revoke scoped grant
9. revoke full-space grant
10. revoke API key
11. check linked clients summary
12. verify client operator access is not editable on this page

---

## 10. Things That Are Easy To Miss

### 10.1 Client Link Mode Is Not Resource Access

`oauth_client_space_links.accessMode = full` does not mean a user or API key has full access to resources. It means the OAuth client has broad participation rights in that space. Do not display it near user/API-key grants as if it were resource access.

### 10.2 `authorization_space full_access` Is Resource Access, Not Management Access

Do not use `full_access` to decide whether a user can edit models or create API keys.

### 10.3 Backing Client Must Not Leak Into Resource Decisions

The backing client is only for Better Auth API-key storage while the API-key system is client-owned. Resource grants must be checked by model/space, not by backing client.

### 10.4 Legacy Untagged API Keys Are Dangerous

The current list includes keys without `authorization_space_id` for migration compatibility. That can make one client's key look like a space key. Move them into a separate legacy panel or hide them from the space page.

### 10.5 Prefix-Based Cascades Can Delete Too Much

Any cascade based on:

```text
client_<clientId>:
```

can cross authorization-space boundaries if several spaces use the same historical client prefix. Use `authorizationSpaceId` for space cascades.

### 10.6 Model Display Names Can Collide

These stored names have the same display name:

```text
client_a:book
client_b:book
book
```

The space-native UI must detect and explain collisions.

### 10.7 Deleting Relations Is More Dangerous Than Deleting Permissions

Tuples store relations, not permission names. Removing a relation can invalidate grants immediately. Removing a permission changes how callers ask for access but may not delete tuples. Treat relation removal as a hard dependency check.

### 10.8 Model Rename Must Update Denormalized Tuple Strings

`entityTypeId` is the stable reference, but `access_tuples.entity_type` is still used in queries and debugging. Keep it synchronized after rename.

### 10.9 Resource Token Flow Depends On Links

R4 resource-token issuance depends on clients being linked to the configured Payload space/resource server. Do not remove links as part of UI cleanup without checking token issuance.

### 10.10 Payload Projection Still Uses Existing Entity Types

Do not rename Payload model entity types from `client_<clientId>:book` to `book` until Payload webhook/reconcile/check-permission paths are audited and migrated.

---

## 11. Completion Criteria

This correction is complete when:

1. `/admin/authorization-spaces/[id]/access` has one coherent space-native tab set.
2. The page no longer embeds `AccessControl` through `ClientProvider`.
3. The page no longer imports `/app/admin/clients/[id]/access/actions`.
4. Editable OAuth-client platform access is not on the authorization-space access page.
5. Models are listed and edited by `authorizationSpaceId`, not backing client prefix.
6. Resource grants are created/revoked by `authorizationSpaceId`.
7. API keys are listed/created/revoked by `authorizationSpaceId`.
8. Full-space access uses `authorization_space full_access`.
9. Client backing is only an internal API-key storage bridge.
10. Legacy untagged API keys are not mixed into the normal space key list.
11. Cross-space mutations are rejected server-side.
12. Tests cover model, grant, API-key, and backing-client edge cases.
