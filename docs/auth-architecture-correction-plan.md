# Auth Architecture Correction Plan

> Status: target-state architecture and migration plan
>
> Last updated: 2026-05-02
>
> Goal: remove the remaining conceptual anti-patterns in the current `auther` + `payloadcms` + `next-blog` auth/authz system and converge on a model that matches standard OAuth/OIDC and resource-authorization boundaries.

---

## 1. Answer First

No. The earlier 3-phase plan is not quite enough if the goal is “conceptually right” rather than “works cleanly enough”.

The earlier plan fixes the immediate coupling, but it still leaves one important architectural smell:

- the system still risks treating the OAuth client and the resource authorization boundary as adjacent concepts, even if they are no longer literally the same field

That is better than the current design, but it is still not the cleanest shape.

If you want the model to look right and stay understandable over time, the target architecture should explicitly separate:

1. **Identity Provider**
2. **OAuth Client**
3. **Resource Server**
4. **Authorization Space**
5. **Policy / Tuple Store**
6. **Read Model / Projection**

The rest of this document defines that model and a migration path to it.

---

## 2. Design Principles

These principles are the standard to judge all future auth changes against.

### 2.1 OAuth Client Is Not an Authorization Domain

An OAuth client is an application that requests tokens.

It is not:

- the content namespace
- the resource server
- the permanent permission pool
- the place where tuples “belong”

### 2.2 ID Tokens Are for Identity, Not Resource Authorization

An `id_token` tells the client who the user is.

It should not be the primary bearer token for backend resource access.

The resource-facing contract should use an `access_token` with a clear audience or resource-server identifier.

### 2.3 Authorization Must Be Scoped to a First-Class Resource Boundary

Permissions should be attached to a clear domain:

- workspace
- tenant
- project
- resource space
- content domain

In this system, the cleanest term is:

- **Authorization Space**

### 2.4 Projections Are Read Models, Not the Source of Truth

Payload’s mirrored grants are fine as a read model.

They must remain:

- derivable from Auther
- replaceable
- eventually consistent by design

They must not become the canonical grant store.

### 2.5 Policy Extensions Must Not Define Topology

Lua / ABAC logic is useful for dynamic decisions.

It should not determine:

- which client maps to which resource server
- which scope is authoritative
- how identities are linked

Topology belongs in explicit schema and explicit services.

---

## 3. Current Anti-Patterns

This section names the current problems precisely.

### 3.1 `clientId` Is Overloaded

Today `clientId` is doing too much:

- login application identity
- content authorization namespace
- webhook routing key
- Payload mirror scope selector
- sometimes indirect audience meaning

This is the main anti-pattern.

### 3.2 Payload Content Auth Is Coupled to a Specific OAuth Client

Payload mirror and reconcile logic are keyed to `PAYLOAD_CLIENT_ID`.

That makes one OAuth client effectively special.

### 3.3 Browser and Resource Auth Are Mixed

Current behavior accepts the Better Auth JWT directly and uses it like a cross-app resource token.

That works, but the contract is not explicit enough:

- is this a browser session token?
- is this an API access token?
- is this an identity token?

Those should not be conflated.

### 3.4 Cross-Scope Grant Projection Exists Implicitly

Registration contexts can already target grants by `entityTypeId`.

That makes cross-client projection possible in practice, but not explicit in the domain model.

This is dangerous because:

- UI may hide it
- validation may not fully enforce it
- operators may not understand it

### 3.5 Payload Bootstrap Depends on Eventual Projection Timing

A new or newly linked user can authenticate before all mirrored grants are ready.

That is not conceptually wrong for CQRS, but it needs a first-request correctness rule.

---

## 4. Target Concepts

This is the corrected domain model.

### 4.1 Identity Provider

`auther` is the Identity Provider and authorization control plane.

Responsibilities:

- authentication
- user accounts
- sessions
- OAuth/OIDC
- authorization models
- tuples / grants
- policy evaluation
- event emission

### 4.2 OAuth Client

An OAuth client is a relying party application.

Examples:

- `payload-admin-web`
- `next-blog-web`
- `mobile-reader-app`

Responsibilities:

- initiate login
- receive callback
- hold session state
- request tokens

Not responsible for owning the resource authorization namespace.

### 4.3 Resource Server

A resource server is the API or backend that consumes access tokens.

Examples:

- `payload-content-api`
- `auther-management-api`
- future `reader-api`

Responsibilities:

- validate access tokens
- enforce audience/resource binding
- authorize access to protected resources

### 4.4 Authorization Space

This is the most important new concept.

An authorization space is the scope in which resource models and grants live.

Examples:

- `payload-content`
- `internal-admin`
- `billing`

Responsibilities:

- own authorization models
- own resource-type namespaces
- own tuples
- define what “book”, “chapter”, and “comment” mean in that space

OAuth clients attach to spaces.

Resource servers consume one or more spaces.

### 4.5 Projection

A projection is a consumer-specific read model derived from the authorization space.

Examples:

- Payload `grant-mirror`
- a future search-access index
- a reporting snapshot

Projection responsibilities:

- optimize reads
- denormalize external auth state
- support local query efficiency

Not the source of truth.

---

## 5. Target Relationships

The clean target model is:

```text
User
  authenticated by
Identity Provider (Auther)

OAuth Client
  requests login from
Identity Provider

OAuth Client
  is allowed to request access into
Authorization Space(s)

Authorization Space
  owns
Authorization Model(s)

Authorization Space
  emits
Grant / Membership Events

Resource Server
  consumes token(s) for
Authorization Space(s)

Projection Consumer (Payload)
  subscribes to
Authorization Space event stream
```

Concrete mapping for your system:

- `next-blog` OAuth client -> `blog-web`
- `payloadcms admin` OAuth client -> `payload-admin-web`
- Payload GraphQL/API -> `payload-content-api`
- content grant domain -> `payload-content-space`

Both `blog-web` and `payload-admin-web` can attach to `payload-content-space`.

That removes the need to treat `PAYLOAD_CLIENT_ID` as the special namespace.

---

## 6. Corrected End State

### 6.1 Login

The blog logs in with `blog-web` client.

The Payload admin logs in with `payload-admin-web` client.

Both are just clients.

### 6.2 Token Semantics

The IdP issues:

- browser session
- `id_token` for client identity/session bootstrap
- `access_token` for resource access

The access token must clearly target a resource server or authorization space.

Recommended target:

- audience/resource = `payload-content-api`

### 6.3 Authorization Scope

Resource permissions for books/chapters/comments live in:

- `payload-content-space`

Not in:

- `blog-web`
- `payload-admin-web`

### 6.4 Projection

Payload subscribes to events for:

- `payload-content-space`

Not events for:

- arbitrary clients

This is a much cleaner subscription rule.

---

## 7. What Changes Beyond the Earlier 3 Phases

The earlier 3 phases were:

1. explicit linking / projection
2. authorization space idea
3. token cleanup

To fully remove the anti-patterns, they need to be tightened into the following final plan:

### Phase A. Introduce First-Class Authorization Spaces

This is not optional if you want the model to be correct.

Add a new top-level entity in `auther`:

- `authorization_space`

Suggested fields:

- `id`
- `slug`
- `name`
- `description`
- `resourceServerId`
- `enabled`
- timestamps

### Phase B. Move Authorization Models Under Spaces

Today models are effectively client-owned.

Change them to be space-owned.

A model should belong to:

- `authorizationSpaceId`

not:

- implicitly to `clientId`

Entity type naming can still remain namespaced if helpful, but the canonical ownership should be by space.

### Phase C. Attach OAuth Clients to Spaces

Add a join concept:

- `client_authorization_space_access`

or simpler metadata if cardinality is small.

Suggested semantics:

- client may trigger registration contexts for these spaces
- client may request access tokens for these spaces
- client may show space-specific consent or onboarding

This replaces ad hoc cross-client projection logic.

### Phase D. Attach Resource Servers to Spaces

Add a first-class resource server concept:

- `resource_server`

Suggested fields:

- `id`
- `audience`
- `name`
- `description`
- `jwksValidationRules`
- `allowedAuthorizationSpaces`

For now you may only need one:

- `payload-content-api`

But the concept matters.

### Phase E. Rework Token Semantics

This is the correct final token model:

- `id_token` identifies the user to the client
- `access_token` authorizes calls to `payload-content-api`

`payloadcms` should validate:

- issuer
- audience/resource server
- expiry
- optionally scopes / claims

The blog may still store a local browser session cookie, but the token used toward Payload should be an access token contract, not an implicit ID token reuse.

### Phase F. Re-key Projections by Space, Not Client

Payload should no longer subscribe to:

- “events for `PAYLOAD_CLIENT_ID`”

It should subscribe to:

- “events for `payload-content-space`”

That is the clean projection boundary.

### Phase G. Make Registration Contexts Space-Aware

Registration contexts should target:

- authorization spaces

not:

- arbitrary client-owned model IDs

Suggested model:

- context is owned by a client or platform
- grants reference:
  - `authorizationSpaceId`
  - `resourceType` or `entityTypeId`
  - `relation`

The client is the trigger.
The space is the destination.

That distinction matters.

---

## 8. Revised Architecture Plan

## 8.1 `auther` Structural Changes

### 8.1.1 New Tables / Concepts

Add:

1. `authorization_spaces`
2. `resource_servers`
3. `oauth_client_space_links`

Recommended minimum shape:

#### `authorization_spaces`

```ts
{
  id: string
  slug: string
  name: string
  description?: string
  resourceServerId: string
  enabled: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `resource_servers`

```ts
{
  id: string
  slug: string
  name: string
  audience: string
  description?: string
  enabled: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `oauth_client_space_links`

```ts
{
  id: string
  clientId: string
  authorizationSpaceId: string
  accessMode: 'login_only' | 'can_trigger_contexts' | 'full'
  createdAt: timestamp
}
```

### 8.1.2 Authorization Models

Refactor model ownership so every authorization model belongs to exactly one authorization space.

Suggested result:

- `authorization_models.authorizationSpaceId`

If you still keep `clientId` for migration, treat it as deprecated compatibility state.

### 8.1.3 Tuples

Tuples should be logically keyed to a space.

Two acceptable approaches:

1. add `authorizationSpaceId` on tuples directly
2. derive space from `entityTypeId`

Preferred final shape:

- add `authorizationSpaceId`

Reason:

- simpler filtering
- simpler event emission
- simpler debugging
- avoids repeated resolution work

### 8.1.4 Events

Grant and membership events should include:

- `authorizationSpaceId`
- `resourceServerId` if relevant

`clientId` may remain as optional provenance metadata, but it should no longer be the routing key.

### 8.1.5 Registration Contexts

Registration contexts should be refactored from:

- “client-owned contexts with model-id grants”

to:

- “contexts triggered by a client, granting into one or more allowed spaces”

Suggested new fields:

- `triggerClientId`
- `targetAuthorizationSpaceIds`

Grant items should resolve inside allowed spaces only.

### 8.1.6 Admin UI

The admin UI should show separate panels for:

- OAuth clients
- authorization spaces
- resource servers
- client-to-space links
- projections / webhook subscribers

This is the point where operator mental model becomes correct.

## 8.2 `payloadcms` Structural Changes

### 8.2.1 Payload as Resource Server Consumer

Payload should be explicitly modeled as consuming:

- `payload-content-api`
- `payload-content-space`

### 8.2.2 Token Validation

Payload should validate access tokens for its resource server audience.

If browser session bootstrap still uses a cookie, that cookie should ultimately carry or derive an access token, not rely on ID token semantics.

### 8.2.3 Projection Subscription

Payload webhook / reconcile logic should filter by:

- `authorizationSpaceId == payload-content-space`

not:

- `clientId == PAYLOAD_CLIENT_ID`

### 8.2.4 Mirror Read Model

Keep the mirror.

This is not an anti-pattern if the role is explicit:

- read optimization
- local filtering
- resilience

But make sure:

- bootstrap path exists
- first-request consistency rule exists
- full reconcile path exists

### 8.2.5 User Shadow Record

Payload keeping a local `users` collection is acceptable.

This is not an anti-pattern if it is clearly a local profile/authorization binding record rather than an independent identity source.

Keep:

- `betterAuthUserId`
- local `role`
- local profile data

Do not let it become a competing identity authority.

## 8.3 `next-blog` Structural Changes

### 8.3.1 Blog as OAuth Client

The blog should act only as:

- OAuth/OIDC client
- browser session owner
- frontend for Payload content access

It should not own a second content authorization domain unless that is a deliberate product requirement.

### 8.3.2 Resource Access

The blog should call Payload using access tokens or a backend session derived from access tokens.

### 8.3.3 Session Storage

It is acceptable for the blog to store:

- server-managed session cookie

But that cookie should represent a clean session contract, not “raw repurposed identity token forever”.

---

## 9. What Will Still Be Acceptable After This Refactor

These are not anti-patterns in the final model:

1. **Payload local user shadow**
2. **grant mirror projection**
3. **webhooks plus reconcile**
4. **Lua / ABAC for conditional checks**
5. **multiple clients sharing one authorization space**

Those are all normal once the boundaries are explicit.

---

## 10. Remaining Anti-Patterns to Explicitly Avoid

Even after the redesign, do not do these:

### 10.1 Do Not Re-introduce Client-Owned Authorization by Convenience

If a new feature says “just attach this model to the app/client”, reject it unless the model truly belongs to the app as an app.

Default to authorization space ownership.

### 10.2 Do Not Use Lua To Route Grants Across Spaces

Space and client topology must stay declarative in schema.

### 10.3 Do Not Use Event Consumers As Policy Engines

Payload should project and enforce, not invent new grants.

### 10.4 Do Not Use `id_token` Audience Drift as a Compatibility Strategy

Do not keep adding more client IDs to accepted audience forever if the token is really meant for a resource server.

Move to resource-server audience.

### 10.5 Do Not Let “Projection Lag” Become a Permanent UX Bug

If first authenticated request can randomly fail, fix the bootstrap path.

---

## 11. Migration Strategy

The migration should be progressive, not a flag day.

### Stage 1. Introduce New Concepts in Parallel

Add:

- `authorization_spaces`
- `resource_servers`
- `oauth_client_space_links`

without removing existing client-owned logic.

Populate:

- `payload-content-space`
- `payload-content-api`
- links from:
  - `payload-admin-web`
  - `blog-web`

### Stage 2. Backfill Models Into Spaces

For every existing client-owned authorization model:

1. create or identify the target space
2. assign `authorizationSpaceId`
3. backfill tuple-space linkage

### Stage 3. Emit Space Metadata in Events

Update grant event payloads to include:

- `authorizationSpaceId`

Consumers can read both old and new shape during transition.

### Stage 4. Teach Payload to Filter by Space

Add dual-read compatibility:

- prefer `authorizationSpaceId`
- fall back to old `clientId` during migration

### Stage 5. Convert Registration Context Logic

Update contexts to validate against allowed target spaces instead of implicit cross-client projection.

### Stage 6. Introduce Proper Resource-Server Access Tokens

Add access token issuance rules targeting:

- `payload-content-api`

Update Payload validation accordingly.

### Stage 7. Remove Legacy Client-Owned Assumptions

After all consumers are moved:

- deprecate client-owned model assumptions
- deprecate client-routed projection logic
- deprecate `id_token` reuse as resource bearer

---

## 12. Testing Strategy

## 12.1 Domain-Model Tests

Add tests for:

1. one space linked to multiple clients
2. one resource server consuming one or more spaces
3. model ownership by space
4. tuple filtering by space

## 12.2 Event Tests

Add tests for:

1. grant event includes `authorizationSpaceId`
2. Payload ignores wrong space
3. Payload accepts correct space

## 12.3 Token Tests

Add tests for:

1. `id_token` not accepted as generic resource bearer once migration completes
2. access token with `aud = payload-content-api` is accepted
3. blog browser login still works

## 12.4 Bootstrap Tests

Add tests for:

1. new user logs in through blog and succeeds on first protected request
2. deferred grant path drains synchronously or via explicit bootstrap before first access

---

## 13. Naming Recommendation

Use names that teach the architecture.

Recommended names:

- `authorization_space`
- `resource_server`
- `client_space_link`
- `grant_projection`
- `projection_subscriber`

Avoid names like:

- `shared permission pool`
- `linked client auth bucket`
- `cross-client mirror config`

Those names describe implementation accidents, not durable concepts.

---

## 14. Final Target Example

Here is the target conceptual model for your current product:

### Identity Provider

- `auther`

### OAuth Clients

- `payload-admin-web`
- `next-blog-web`

### Resource Server

- `payload-content-api`

### Authorization Space

- `payload-content-space`

### Models In That Space

- `book`
- `chapter`
- `comment`

### Projection Consumer

- `payloadcms grant-mirror`

### Relationship Summary

- both clients can authenticate users
- both clients can initiate contexts for `payload-content-space` if allowed
- Payload validates tokens for `payload-content-api`
- Payload mirrors only events for `payload-content-space`

That is a clean architecture.

---

## 15. Conclusion

If you implement the earlier 3 phases exactly as originally stated, you will be in a much better place, but not yet in the cleanest conceptual shape.

To remove the remaining anti-patterns, the final correction is:

1. make **authorization space** first-class
2. make **resource server** first-class
3. move **authorization model ownership** from client to space
4. make **projection routing** keyed by space, not client
5. move from **ID-token reuse** to proper **resource-server access tokens**

Once you do that, the remaining complexity is legitimate system complexity, not conceptual distortion.

That is the point where the design becomes “enterprise-shaped” in the good sense rather than “custom-shaped”.

