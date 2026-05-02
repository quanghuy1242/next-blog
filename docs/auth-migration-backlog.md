# Auth Migration Backlog

> Status: concrete migration backlog
>
> Last updated: 2026-05-02
>
> Scope: implementation backlog across `auther`, `payloadcms`, and `next-blog`
>
> This document operationalizes:
>
> - `docs/blog-dedicated-client-auth-plan.md`
> - `docs/auth-architecture-correction-plan.md`

---

## 1. Purpose

This document is the execution backlog for moving from the current design to the corrected target architecture without breaking existing production data or the current OAuth client model in `auther`.

This is not a high-level proposal. It is the implementation checklist, migration ordering, schema work, file-level targets, validation rules, testing plan, rollout strategy, and rollback guidance.

---

## 2. Non-Negotiable Constraint

### 2.1 Do Not Break OAuth Client Semantics In `auther`

The current `auther` OAuth client model is correct in shape and should remain correct:

- OAuth clients remain OAuth clients
- `oauthApplication.type` continues to represent client type
- standard types remain standard types
- do not repurpose “resource server” or “authorization space” into a client type

Current client typing references:

- `auther/src/schemas/clients.ts`
- `auther/src/db/auth-schema.ts`

Today the relevant client shape is already modeled around application-style OAuth clients such as:

- `web`
- `spa`
- `native`

and API key / machine access is already modeled separately enough that we do not need to distort the OAuth client model to add new concepts.

### 2.2 New Concepts Must Be Added Beside Existing OAuth Clients

The following are **new control-plane concepts**, not new OAuth client types:

- `authorization space`
- `resource server`
- `projection subscriber`

These must be added as new tables / metadata / services, not forced into `oauthApplication`.

---

## 3. Summary Of The Target State

At the end of this migration:

1. `auther` remains the IdP and authz control plane
2. OAuth clients remain standard OAuth clients
3. `payloadcms` consumes tokens as a resource server
4. content grants live in a first-class authorization space
5. `next-blog` and `payloadcms admin` are separate login clients
6. both clients can attach to the same content authorization space
7. Payload mirrors grants for that authorization space, not for a hard-coded OAuth client
8. the long-term resource bearer contract uses access tokens, not implicit ID token reuse

---

## 4. Migration Strategy Overview

The backlog is split into four releases:

- `R1` Stabilize current dedicated-blog-client bridge without changing core ownership
- `R2` Introduce first-class authorization-space metadata in `auther`
- `R3` Move Payload projection routing from client-based to space-based
- `R4` Clean up token semantics and remove legacy assumptions

This sequence is intentional:

- `R1` solves near-term product need safely
- `R2` introduces the correct domain model
- `R3` moves projection ownership to the correct boundary
- `R4` removes the remaining token-contract smell

---

## 5. Current-State Dependencies To Respect

This migration must preserve these current production behaviors until explicitly replaced:

### 5.1 `auther`

- OAuth clients are stored in `oauth_application`
- registration contexts are keyed by `clientId`
- grants in registration contexts reference `entityTypeId + relation`
- tuple webhook emission already exists
- client-wide `full_access` already exists

### 5.2 `payloadcms`

- users are linked by `betterAuthUserId`
- mirrored grants are read from `grant-mirror`
- webhook events are filtered by expected client id
- grant sweep and reconciliation are keyed to the configured Payload client
- token verification already uses Better Auth JWKS

### 5.3 `next-blog`

- auth extraction already accepts `betterAuthToken`, `payload-token`, and bearer headers
- Payload API calls already forward bearer tokens
- no auth UI currently exists in the header

---

## 6. Release R1

## 6.1 Goal

Support a dedicated blog OAuth client immediately, while keeping Payload authorization owned by the current Payload client namespace.

This release intentionally uses explicit grant projection into the current Payload scope.

This is the short-to-medium term bridge described in the first architecture document.

## 6.2 `auther` Tasks

### R1-A1 Add `BLOG_CLIENT_ID`

Create a new public PKCE client for `next-blog`.

Files / areas:

- `auther/src/lib/auth.ts`
- `auther/src/env.ts`
- `auther/scripts/seed-oauth-clients-for-tests.ts`
- any deployment env configuration

Tasks:

1. Add env vars:
   - `BLOG_CLIENT_ID`
   - `BLOG_REDIRECT_URI`
   - `BLOG_LOGOUT_REDIRECT_URIS` if needed
2. Register the blog client in trusted clients
3. Use:
   - `tokenEndpointAuthMethod = none`
   - `grantTypes = ["authorization_code"]`
4. Add refresh token support only if the current auth stack already supports it cleanly

### R1-A2 Add Explicit Projection Metadata To OAuth Client Metadata

Add a new field on `oauth_client_metadata`:

```ts
grantProjectionClientIds: string[]
```

Files / areas:

- `auther/src/db/app-schema.ts`
- migration files under `auther/drizzle/`
- `auther/src/lib/repositories/oauth-client-metadata-repository.ts`
- admin settings / client detail actions and UI

Tasks:

1. Extend DB schema
2. write migration
3. parse / serialize JSON safely
4. add repository accessors
5. default to `[]`
6. add admin UI to edit this field

### R1-A3 Validate Cross-Client Registration Context Grants

This is mandatory server-side validation.

Files / areas:

- `auther/src/app/admin/clients/[id]/registration-actions.ts`
- any platform-level registration context creation paths
- shared validation helpers if extracted

Required rule:

For every registration-context grant:

1. resolve `entityTypeId` -> authorization model
2. determine model owner client
3. allow if:
   - model owner client == current client
   - or owner client is in `grantProjectionClientIds`
4. reject otherwise

Additional implementation notes:

- validation must run on create
- validation must run on update
- validation error messages must mention the forbidden target client clearly

### R1-A4 Expand Registration Context UI To Show Allowed Target Models

Current UI only exposes current-client models.

Files / areas:

- `auther/src/app/admin/clients/[id]/registration-actions.ts`
- `auther/src/app/admin/clients/[id]/registration-tabs.tsx`

Tasks:

1. add a new action:
   - `getClientRegistrationGrantTargets(clientId)`
2. include:
   - current client models
   - allowed projected target client models
3. label options with target client clearly
4. prevent ambiguous display like only `book -> viewer`
5. display as:
   - `Payload CMS / book / viewer`
   - `Payload CMS / chapter / viewer`

### R1-A5 Keep Existing Authorize-Time Context Application

No topology rewrite yet.

Do not remove:

- `applyClientContextGrants(clientId, userId)`

Files / areas:

- `auther/src/lib/pipelines/registration-grants.ts`
- `auther/src/lib/auth.ts`

Tasks:

1. keep current behavior
2. rely on improved validation to make projected target grants safe
3. add metrics around projected grant application

Suggested metrics:

- `auth.context_grant.applied.count`
- `auth.context_grant.projected.count`
- `auth.context_grant.projected.error.count`

### R1-A6 Ensure Grant Events Preserve Payload Target Routing

Projected tuples must still emit webhook payloads whose `clientId` resolves to the Payload client namespace.

Files / areas:

- `auther/src/lib/webhooks/grant-events.ts`

Tasks:

1. verify `resolveGrantClientId()` produces Payload client id for projected Payload-scoped tuples
2. add tests for:
   - tuple minted from blog-triggered context
   - emitted webhook clientId == payload client id

## 6.3 `payloadcms` Tasks

### R1-P1 Accept Blog-Issued JWT Audience During Transition

If Payload currently enforces audience, allow both Payload and blog client audiences during the transition.

Files / areas:

- `payloadcms/src/lib/betterAuth/tokens.ts`
- `payloadcms/src/lib/betterAuth/env.ts`
- deployment env config

Tasks:

1. ensure env parser supports multiple audiences
2. set audience config to include:
   - `PAYLOAD_CLIENT_ID`
   - `BLOG_CLIENT_ID`
3. do not disable audience validation globally

### R1-P2 Fix First-Authenticated-Request Race

This is required before the blog flow is considered reliable.

Files / areas:

- `payloadcms/src/lib/betterAuth/users.ts`
- `payloadcms/src/utils/access.ts`
- `payloadcms/src/utils/deferredGrants.ts`

Tasks:

1. detect in `upsertBetterAuthUser` whether the user was:
   - newly created
   - newly linked by email match
2. synchronously drain deferred grants for that user before returning the authenticated user
3. preserve the current asynchronous `afterOperation` drain as fallback

Acceptance condition:

- first authenticated content request after blog login must not fail because the mirror was late

### R1-P3 Keep Payload Mirroring Bound To Payload Client

Do not generalize the webhook endpoint in R1.

Files / areas:

- `payloadcms/src/app/api/webhooks/auther/route.ts`
- `payloadcms/src/utils/grantMirror.ts`
- `payloadcms/src/app/api/internal/reconcile/route.ts`

Tasks:

1. leave client-based filtering in place
2. only consume projected Payload-scoped tuples
3. add tests proving wrong-client projected events are skipped

## 6.4 `next-blog` Tasks

### R1-B1 Add Blog-Owned Auth Routes

Files / areas:

- new route(s) under `pages/auth/`
- or `pages/api/auth/` plus thin redirect pages

Required routes:

- `/auth/login`
- `/auth/callback`
- `/auth/logout`

Tasks:

1. implement PKCE generation
2. store verifier/state in HttpOnly cookie
3. redirect to `auther` authorize endpoint with `BLOG_CLIENT_ID`
4. exchange code at callback
5. store returned JWT in:
   - `betterAuthToken`
   - `payload-token`
6. clear PKCE cookie
7. restore return URL

### R1-B2 Add Shared Cookie Helper

Files / areas:

- new helper in `next-blog/common/utils/` or `common/auth/`

Tasks:

1. derive shared domain for production
2. use host-only cookies for localhost
3. expose set/clear helpers for:
   - `betterAuthToken`
   - `payload-token`

### R1-B3 Add Header Sign-In Entry

Files / areas:

- `next-blog/components/core/header.tsx`

Tasks:

1. add `Sign in` link
2. optionally preserve `About me`
3. later, add authenticated state if desired

### R1-B4 No Rework To Existing Token Extraction

Files / areas:

- `next-blog/common/utils/auth.ts`
- `next-blog/common/apis/base.ts`

Task:

- leave unchanged unless tests reveal a mismatch in cookie names or bearer precedence

## 6.5 R1 Exit Criteria

R1 is done when:

1. blog uses its own OAuth client
2. a projected blog registration context can mint Payload-scoped grants
3. Payload mirrors those grants without any multi-client refactor
4. a new user can sign in through blog and access protected content on the first real request

---

## 7. Release R2

## 7.1 Goal

Introduce first-class `authorization space` and `resource server` concepts in `auther` without breaking existing OAuth client semantics.

This release is additive.

## 7.2 `auther` Tasks

### R2-A1 Add `authorization_spaces` Table

Create new schema.

Suggested fields:

```ts
id: string
slug: string
name: string
description?: string
enabled: boolean
resourceServerId?: string
createdAt
updatedAt
```

Files / areas:

- `auther/src/db/`
- migrations
- repositories

Tasks:

1. add DB schema
2. add repository
3. add admin CRUD actions
4. add admin UI

### R2-A2 Add `resource_servers` Table

This is not an OAuth client table.

Suggested fields:

```ts
id: string
slug: string
name: string
audience: string
description?: string
enabled: boolean
createdAt
updatedAt
```

Files / areas:

- `auther/src/db/`
- migrations
- repositories
- admin UI/actions

Tasks:

1. add DB schema
2. add repository
3. admin CRUD
4. add validation that audience values are unique and URL-safe if needed

### R2-A3 Add `oauth_client_space_links`

This creates an explicit link between login clients and authorization spaces.

Suggested fields:

```ts
id: string
clientId: string
authorizationSpaceId: string
accessMode: 'login_only' | 'can_trigger_contexts' | 'full'
createdAt
updatedAt
```

Tasks:

1. add schema and migration
2. repository methods:
   - listByClientId
   - listByAuthorizationSpaceId
   - create
   - delete
3. admin UI to manage links

### R2-A4 Add Space Ownership To Authorization Models

Current models are effectively client-bound.

Add:

- `authorizationSpaceId`

Files / areas:

- model schema / repository
- model CRUD actions
- model UI

Tasks:

1. schema migration to add nullable field initially
2. backfill existing Payload content models into a new space later in R2
3. once backfill is complete, tighten validation so new models must belong to a space

### R2-A5 Add Transition Compatibility

During R2:

- existing client-owned assumptions still exist
- new space-based metadata is introduced in parallel

Tasks:

1. keep old fields readable
2. add compatibility helpers:
   - resolveModelOwningClientOrSpace
   - resolveTargetAuthorizationSpace
3. avoid deleting old code paths yet

### R2-A6 Move Registration Context Validation To Space-Aware Rules

New rule set:

1. a client may trigger contexts only for spaces linked to that client
2. a grant target model must belong to one of the context’s allowed spaces

Tasks:

1. add space-based validation helpers
2. keep old projection-client allowlist only as migration compatibility
3. mark `grantProjectionClientIds` as transitional metadata

## 7.3 `payloadcms` Tasks

### R2-P1 Add Space-Aware Config Support

Files / areas:

- `payloadcms/src/lib/env.ts`
- new config helper if needed

Add new env vars:

- `AUTHER_AUTHORIZATION_SPACE_ID`
- `AUTHER_AUTHORIZATION_SPACE_SLUG`

These are not used as primary filters yet in R2, but prepare the consumer.

### R2-P2 Add Dual Metadata Support In Projection Helpers

Files / areas:

- `payloadcms/src/utils/grantMirror.ts`
- `payloadcms/src/app/api/webhooks/auther/route.ts`

Tasks:

1. extend event-parsing types to accept future `authorizationSpaceId`
2. do not switch routing yet
3. preserve current client-based behavior as source of truth

## 7.4 `next-blog` Tasks

### R2-B1 No Major Flow Change

The blog should not need major changes in R2 beyond consuming any renamed env vars if introduced.

Tasks:

1. keep R1 auth flow stable
2. avoid rework while control-plane concepts are being added in `auther`

## 7.5 R2 Exit Criteria

R2 is done when:

1. `authorization space` and `resource server` exist as first-class concepts in `auther`
2. OAuth client model remains unchanged
3. authorization models can be linked to spaces
4. clients can be linked to spaces
5. system still behaves compatibly with current production routing

---

## 8. Release R3

## 8.1 Goal

Make Payload projection routing space-based rather than client-based.

This is the release that removes the specialness of `PAYLOAD_CLIENT_ID` as projection router.

## 8.2 `auther` Tasks

### R3-A1 Add `authorizationSpaceId` To Grant Event Payloads

Files / areas:

- `auther/src/lib/webhooks/grant-events.ts`
- event payload types
- tuple event emission tests

Tasks:

1. include `authorizationSpaceId` in `grant.created`
2. include `authorizationSpaceId` in `grant.revoked`
3. include it in any condition-update grant events
4. preserve `clientId` temporarily for compatibility

### R3-A2 Add Space Resolution On Tuple Creation

Files / areas:

- tuple repository
- authorization model repository / services

Tasks:

1. when a tuple is created from a model-linked grant, resolve and persist the model’s `authorizationSpaceId`
2. if tuple schema is extended, backfill old tuples

Preferred outcome:

- tuples are directly queryable by authorization space

### R3-A3 Add Space-Based Internal Grant Listing APIs

Files / areas:

- `auther/src/app/api/internal/clients/...` compatibility routes
- new internal routes keyed by authorization space

Suggested new routes:

- `/api/internal/authorization-spaces/:spaceId/grants`
- `/api/internal/authorization-spaces/:spaceId/list-objects`

Compatibility:

- old client-based routes remain temporarily
- new routes become the preferred consumer path

## 8.3 `payloadcms` Tasks

### R3-P1 Switch Webhook Filtering From Client To Space

Files / areas:

- `payloadcms/src/app/api/webhooks/auther/route.ts`

Tasks:

1. accept both old and new event shapes during migration
2. prefer `authorizationSpaceId` match if present
3. fall back to old `clientId` only if no space metadata is present
4. add explicit logs during dual-mode period

### R3-P2 Switch Reconcile And Grant Sweep To Space-Based APIs

Files / areas:

- `payloadcms/src/utils/grantMirror.ts`
- `payloadcms/src/app/api/internal/reconcile/route.ts`

Tasks:

1. add space-based equivalents of:
   - client grant sweep
   - list-objects resolution
2. update reconcile job to use authorization space
3. keep old path behind compatibility feature flag until stable

### R3-P3 Add Migration Flags

Suggested env flags:

- `AUTHER_USE_SPACE_ROUTING=true|false`

Tasks:

1. allow controlled rollout in preview/staging
2. emit logs showing whether a request used client routing or space routing

## 8.4 `next-blog` Tasks

### R3-B1 No Behavioral Change Required

The blog should remain mostly unchanged in R3.

Only update docs and env references if names change.

## 8.5 R3 Exit Criteria

R3 is done when:

1. Payload projection routing uses `authorizationSpaceId`
2. Payload no longer depends on `PAYLOAD_CLIENT_ID` for grant mirror ownership
3. old client-based compatibility paths still exist but are no longer primary

---

## 9. Release R4

## 9.1 Goal

Clean up token semantics so resource access uses a clear access-token contract rather than implicit ID-token reuse.

## 9.2 `auther` Tasks

### R4-A1 Define Payload Resource-Server Audience

Use the `resource_servers` table to define:

- `payload-content-api`

with audience, for example:

- `https://payload-content-api`

or another stable internal identifier if URLs are not your audience style.

### R4-A2 Ensure Access Tokens Can Target Payload Resource Server

Files / areas:

- OIDC/OAuth token issuance paths
- any trusted-client configuration

Tasks:

1. determine how resource audience is selected during auth/token flow
2. ensure blog and Payload admin clients can obtain access tokens valid for Payload resource server
3. keep ID token issuance unchanged for client identity needs

### R4-A3 Document Token Contract

Add internal docs covering:

- browser session
- id_token
- access_token
- refresh token if used
- Payload resource audience

## 9.3 `payloadcms` Tasks

### R4-P1 Validate Access Tokens For Resource-Server Audience

Files / areas:

- `payloadcms/src/lib/betterAuth/tokens.ts`
- possibly auth strategy helpers

Tasks:

1. switch verification expectation from “accept multiple client audiences” to “accept Payload resource-server audience”
2. preserve a controlled migration window if needed

### R4-P2 Stop Treating ID Token Reuse As The Main Contract

Files / areas:

- Payload callback flow
- auth cookie helpers
- strategy comments/docs

Tasks:

1. decide whether cookies store:
   - access token directly
   - session token that corresponds to an access-token-backed session
2. remove code/comments that describe ID token reuse as the desired long-term model

## 9.4 `next-blog` Tasks

### R4-B1 Update Blog Callback To Store The Correct Resource-Bearer Contract

Files / areas:

- blog auth callback route
- local cookie helpers

Tasks:

1. store the token type the blog should actually present to Payload
2. if both ID and access tokens are returned, decide what to persist and what to keep internal
3. update tests accordingly

## 9.5 R4 Exit Criteria

R4 is done when:

1. Payload consumes access tokens as a proper resource server
2. client audience drift is no longer the main compatibility mechanism
3. the blog login flow still works with the corrected token contract

---

## 10. Data Migration Work

## 10.1 `auther` DB Migrations

Required migrations across releases:

### R1

1. add `grantProjectionClientIds` to `oauth_client_metadata`

### R2

2. add `authorization_spaces`
3. add `resource_servers`
4. add `oauth_client_space_links`
5. add nullable `authorizationSpaceId` to authorization model table

### R3

6. optionally add `authorizationSpaceId` directly to `access_tuples`

Recommendation:

- if you add `authorizationSpaceId` to tuples, do it in R3 only after R2 backfill is complete

## 10.2 Backfill Steps

### Backfill 1: Blog Projection Metadata

1. create `BLOG_CLIENT_ID`
2. update blog client metadata with projection rights to current Payload client

### Backfill 2: Authorization Space

1. create `payload-content-space`
2. create `payload-content-api`
3. link:
   - blog client -> payload content space
   - payload admin client -> payload content space

### Backfill 3: Existing Models

For every Payload content model currently scoped under Payload client:

1. assign `authorizationSpaceId = payload-content-space`

### Backfill 4: Existing Tuples

If tuple schema gains `authorizationSpaceId`:

1. for tuples with `entityTypeId`, resolve model and stamp space id
2. for platform tuples such as `oauth_client/use/admin/owner`, leave null unless you later formalize platform spaces

---

## 11. Feature Flags And Rollout Controls

Use flags to make the migration safe.

Recommended flags:

- `AUTHER_ENABLE_CLIENT_PROJECTION_VALIDATION`
- `AUTHER_ENABLE_AUTHORIZATION_SPACES`
- `AUTHER_EMIT_AUTHORIZATION_SPACE_IN_EVENTS`
- `PAYLOAD_ENABLE_SPACE_ROUTING`
- `PAYLOAD_SYNC_DEFERRED_GRANTS_ON_AUTH`
- `BLOG_USE_DEDICATED_OAUTH_CLIENT`
- `PAYLOAD_ACCEPT_CLIENT_AUDIENCES`
- `PAYLOAD_ACCEPT_RESOURCE_SERVER_AUDIENCE`

Rollout order:

1. enable producer compatibility before consumer enforcement
2. enable synchronous deferred-grant handling before blog production launch
3. only disable old routing after multi-environment verification

---

## 12. Testing Backlog

## 12.1 `auther`

### Unit / Integration

1. registration context create rejects unauthorized projected target models
2. blog client can create projected Payload-target contexts when explicitly allowed
3. authorize flow applies projected contexts correctly
4. tuple events resolve current Payload client in R1
5. tuple events emit `authorizationSpaceId` in R3
6. client-space link validation works

### Migration Tests

7. model backfill to space preserves tuple resolution
8. old client-based route and new space-based route return equivalent grant sets during migration

## 12.2 `payloadcms`

### Unit / Integration

1. auth accepts blog audience in R1
2. deferred grant drain is synchronous for first auth link/create
3. wrong-client projected event is skipped in R1
4. correct projected Payload-scoped event mirrors successfully in R1
5. space-routed webhook event mirrors successfully in R3
6. reconcile by space and reconcile by client are equivalent during migration

### E2E

7. new user blog login -> first private-book request succeeds
8. existing user blog login -> protected chapter request succeeds
9. revoke grant -> mirror is updated and access disappears

## 12.3 `next-blog`

### Unit / Integration

1. login route builds PKCE authorize redirect
2. callback exchanges code and stores cookies
3. logout clears cookies
4. header shows sign-in link
5. browser request after callback includes correct cookie-based auth flow

### E2E

6. unauthenticated user redirected to login for protected feature
7. user returns from auth and succeeds without visiting Payload first
8. refresh/revisit still works with existing session

---

## 13. Manual Verification Backlog

Run these scenarios in staging for each release:

### R1

1. existing Payload-linked user signs in through blog
2. email-matched but unlinked user signs in through blog
3. totally new user signs in through blog
4. invalid state / expired PKCE
5. projected context disabled
6. Payload webhook outage then reconcile recovery

### R2

7. create authorization space
8. link blog and payload admin clients to same space
9. create registration context against linked space

### R3

10. space-routed events mirror correctly
11. client-routed compatibility still works when flag disabled

### R4

12. Payload accepts resource-server audience
13. old client-audience acceptance is safely disabled

---

## 14. Rollback Guidance

## 14.1 R1 Rollback

If blog dedicated client flow fails:

1. disable `BLOG_USE_DEDICATED_OAUTH_CLIENT`
2. revert blog sign-in button to existing Payload login path
3. keep metadata/schema additions in place if harmless

## 14.2 R2 Rollback

If authorization-space introduction causes admin/control-plane issues:

1. keep space records but disable `AUTHER_ENABLE_AUTHORIZATION_SPACES`
2. continue using client-based projection and validation

## 14.3 R3 Rollback

If Payload projection routing fails under space mode:

1. disable `PAYLOAD_ENABLE_SPACE_ROUTING`
2. continue consuming client-routed events
3. keep event payload dual-shape support enabled

## 14.4 R4 Rollback

If resource-server audience validation breaks production flows:

1. temporarily re-enable `PAYLOAD_ACCEPT_CLIENT_AUDIENCES`
2. keep resource-server issuance in staging only

---

## 15. Documentation Backlog

Update or add these docs as work lands:

### `auther`

1. OAuth client model remains standard
2. authorization spaces concept
3. resource server concept
4. registration context targeting rules
5. token contract for resource access

### `payloadcms`

6. projection model and source-of-truth explanation
7. deferred-grant bootstrap behavior
8. resource-server token expectations

### `next-blog`

9. blog auth callback flow
10. cookie/session behavior
11. protected-feature login path

---

## 16. Recommended Work Breakdown By Sprint

## Sprint 1

- R1-A1 through R1-A6
- R1-P1 through R1-P3
- R1-B1 through R1-B4

## Sprint 2

- harden R1 tests
- fix any first-request bugs
- ship dedicated blog client

## Sprint 3

- R2-A1 through R2-A6
- R2-P1 through R2-P2

## Sprint 4

- backfill models to spaces
- admin UI for spaces and links
- begin dual-routing support

## Sprint 5

- R3-A1 through R3-A3
- R3-P1 through R3-P3

## Sprint 6

- R4-A1 through R4-A3
- R4-P1 through R4-P2
- R4-B1

---

## 17. Final Acceptance Criteria

The migration is complete when all of the following are true:

1. `auther` still uses standard OAuth client semantics and client typing
2. `next-blog` and Payload admin are separate login clients
3. Payload content authorization belongs to a first-class authorization space
4. Payload projection routing is keyed by authorization space, not OAuth client id
5. browser login and resource authorization are token-contractually separated
6. first authenticated request after blog login is correct for both existing and brand-new users
7. no production path depends on hidden cross-client grant behavior

---

## 18. What This Backlog Explicitly Avoids

This plan does not do the following:

1. repurpose OAuth client type to mean resource server
2. invent a nonstandard “resource client” concept inside the OAuth client table
3. translate one app token into another app token as a permanent strategy
4. make Payload the source of truth for grants
5. use Lua to define system topology

Those would all be regressions relative to the corrected architecture.

