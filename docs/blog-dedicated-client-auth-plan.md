# Blog Dedicated OAuth Client -> Payload Grant Projection Plan

> Status: implementation plan
>
> Last updated: 2026-05-02
>
> Goal: support `next-blog` as its own OAuth/OIDC client in `auther` without breaking the existing Payload-backed authorization model, mirrored grant flow, or shared-user behavior.

---

## 1. Executive Summary

The correct bridge for a new blog client is **not token mapping**. The same Better Auth JWT can already be consumed by both `next-blog` and `payloadcms`. The real problem is **authorization scope**, not token format.

Recommended design:

1. Add a new public PKCE OAuth client for `next-blog` in `auther`.
2. Let `next-blog` own its own `/auth/login` and `/auth/callback` flow.
3. Store the returned Better Auth `id_token` on the blog origin using the same cookie names the blog and Payload already understand.
4. Keep `PAYLOAD_CLIENT_ID` as the source of truth for Payload content authorization.
5. Add an explicit **grant projection** capability in `auther` so a blog-owned registration context can mint tuples in the Payload client namespace.
6. Keep Payload webhook mirroring scoped to the Payload client only.

This avoids:

- a fake “token translation” layer
- multi-client grant mirroring in Payload
- special-case auth logic in the blog API layer
- weakening Payload’s authorization boundaries

---

## 2. Problem Statement

### 2.1 Desired Future State

The blog should be able to:

- redirect a user to `auther`
- authenticate with a dedicated blog client
- return to `next-blog`
- immediately use authenticated Payload-backed features such as:
  - private books
  - private chapters
  - comments
  - bookmarks
  - reading progress

without forcing the user to log in via the Payload site first.

### 2.2 What Breaks If We Only Add a New Blog Client

Authentication would work, but authorization would drift:

- `next-blog` can obtain a Better Auth token from `auther`
- `payloadcms` can only mirror and reconcile grants for the configured Payload client scope
- a dedicated blog client would therefore authenticate users but would not automatically produce Payload-readable mirrored grants

The current system is already designed around a single authorization scope for Payload content.

---

## 3. Current System Facts

This section captures the important behaviors already present in the three repos.

### 3.1 `next-blog`

The blog already accepts auth from:

- `Authorization: Bearer <token>`
- `betterAuthToken`
- `payload-token`
- `better-auth.session_token`

Source: `next-blog/common/utils/auth.ts`

The blog forwards auth tokens to Payload GraphQL as `Authorization: Bearer <token>`.

Source: `next-blog/common/apis/base.ts`

The header is currently static and has no auth entry point.

Source: `next-blog/components/core/header.tsx`

### 3.2 `payloadcms`

Payload does not require a special internal token format. It already trusts Better Auth JWTs directly through JWKS verification.

Source: `payloadcms/src/lib/betterAuth/tokens.ts`

Payload’s OAuth callback currently stores the Better Auth `id_token` into:

- `betterAuthToken`
- `payload-token`

Source: `payloadcms/src/app/(payload)/auth/callback/route.ts`

Payload users are linked to Better Auth users via `betterAuthUserId`.

Source:

- `payloadcms/src/collections/Users.ts`
- `payloadcms/src/lib/betterAuth/users.ts`

Payload mirrors grant tuples from Auther into `grant-mirror`, but only for a narrow set of content entity types:

- `book`
- `chapter`
- `comment`

Source: `payloadcms/src/app/api/webhooks/auther/route.ts`

Payload’s reconciliation and mirror fetches are hard-wired to the configured Payload client scope.

Source: `payloadcms/src/utils/grantMirror.ts`

Payload’s Auther webhook endpoint drops events for other client IDs when `AUTHER_CLIENT_ID` is configured.

Source: `payloadcms/src/app/api/webhooks/auther/route.ts`

### 3.3 `auther`

Auther already supports:

- a confidential Payload admin client
- a public PKCE SPA client
- per-client access policies
- registration contexts
- tuple-based authorization
- client-wide `full_access`
- client-scoped resource tuples

Sources:

- `auther/src/lib/auth.ts`
- `auther/src/lib/utils/oauth-authorization.ts`
- `auther/src/lib/pipelines/registration-grants.ts`
- `auther/src/lib/services/registration-context-service.ts`
- `auther/src/lib/auth/permission-service.ts`

Registration contexts are important:

- the context itself is scoped to a client via `registration_contexts.clientId`
- the actual grants are stored as `entityTypeId + relation`
- grant application resolves the model by `entityTypeId` and creates tuples for the model’s current entity type

Source:

- `auther/src/db/platform-access-schema.ts`
- `auther/src/lib/services/registration-context-service.ts`

This means client ownership of a registration context and target authorization scope are already partially decoupled in the data model.

---

## 4. Key Architectural Decision

### 4.1 Do Not Build Token Mapping

Do not build a service that “maps a blog token to a Payload token”.

Reasons:

1. The token issuer is already the same.
2. Payload already verifies Better Auth JWTs directly.
3. The blog already knows how to forward those tokens to Payload.
4. Token translation adds:
   - expiry synchronization problems
   - audience/issuer confusion
   - revocation complexity
   - unnecessary security surface

The system does not need a new token. It needs the right **tuples**.

### 4.2 Use Grant Projection Instead

The recommended bridge is:

- authenticate with `BLOG_CLIENT_ID`
- authorize content using tuples under `PAYLOAD_CLIENT_ID`

This keeps:

- login UX separate
- content authorization centralized
- Payload mirror logic unchanged in principle

---

## 5. Target End State

### 5.1 Request Flow

1. User clicks `Sign in` on `next-blog`.
2. Blog starts a PKCE OAuth flow against `auther` using `BLOG_CLIENT_ID`.
3. User signs in at `auther`.
4. During authorize flow, `auther` runs `applyClientContextGrants(BLOG_CLIENT_ID, userId)`.
5. Blog-owned registration contexts project grants into Payload-scoped models such as:
   - `client_<PAYLOAD_CLIENT_ID>:book`
   - `client_<PAYLOAD_CLIENT_ID>:chapter`
   - `client_<PAYLOAD_CLIENT_ID>:comment`
6. Auther emits tuple webhooks for those Payload-scoped grants.
7. Payload webhook receives them because the emitted `clientId` resolves to `PAYLOAD_CLIENT_ID`.
8. Payload mirrors the grants into `grant-mirror`.
9. Blog callback stores the Better Auth `id_token` as local/shared cookies.
10. Subsequent blog requests forward the same token to Payload.
11. Payload authenticates the user via Better Auth JWT verification and reads mirrored grants.

### 5.2 Critical Property

The **login client** and the **authorization scope client** are intentionally different:

- login client: `BLOG_CLIENT_ID`
- content authorization scope: `PAYLOAD_CLIENT_ID`

This is the core of the design.

---

## 6. Why This Works With the Existing Code

### 6.1 Tokens Are Already Shareable

The current Payload callback stores the raw Better Auth `id_token` in cookies. The blog can do the same. No new token format is required.

### 6.2 Payload Only Cares About Better Auth Identity and Payload-Scoped Grants

Payload links users by `betterAuthUserId`, not by OAuth client ID.

As long as:

- the user is the same Better Auth user
- the JWT passes Payload verification
- the mirrored tuples are under the Payload client namespace

the source login client does not matter.

### 6.3 Registration Contexts Already Use `entityTypeId`

Because registration contexts resolve grants from `entityTypeId`, a blog-owned context can mint tuples for Payload models if we explicitly allow it.

This is the main leverage point that makes the design feasible without rewriting the Payload mirror architecture.

---

## 7. Required Changes By Repo

## 7.1 `next-blog` Changes

### 7.1.1 Add Dedicated Blog Auth Flow

Create blog-owned auth routes:

- `pages/auth/login.ts`
- `pages/auth/callback.ts`
- `pages/auth/logout.ts`

or equivalent API-route driven redirect endpoints if preferred.

Recommended behavior:

#### `/auth/login`

- generate PKCE verifier + challenge
- generate state
- store a short-lived HttpOnly cookie containing:
  - `state`
  - `verifier`
  - `createdAt`
  - `returnTo`
- redirect to:
  - `${AUTH_BASE_URL}/api/auth/oauth2/authorize`

Params:

- `client_id = BLOG_CLIENT_ID`
- `redirect_uri = BLOG_REDIRECT_URI`
- `response_type = code`
- `scope = openid email profile`
- `state = ...`
- `code_challenge = ...`
- `code_challenge_method = S256`

#### `/auth/callback`

- validate `state`
- validate cookie age
- exchange code at `${AUTH_BASE_URL}/api/auth/oauth2/token`
- because this is a public client, send:
  - `grant_type=authorization_code`
  - `client_id=BLOG_CLIENT_ID`
  - `code=...`
  - `redirect_uri=BLOG_REDIRECT_URI`
  - `code_verifier=...`
- extract `id_token`
- set cookies understood by existing blog/Payload auth extraction:
  - `betterAuthToken`
  - `payload-token`
- clear PKCE cookie
- redirect to original `returnTo`

### 7.1.2 Cookie Strategy

Add a shared helper in `next-blog` similar to Payload’s cookie-domain logic.

Recommendation:

- support shared parent-domain cookies in production
- use host-only cookies on localhost

New helper should set:

- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: true` in production
- `path: '/'`
- optional parent domain such as `.quanghuy.dev`

### 7.1.3 Header Integration

Update the header so:

- unauthenticated state shows `Sign in`
- authenticated state shows either:
  - `Sign out`
  - or `Account` + `Sign out`

Minimal first version:

- replace `About me` with `Sign in`
- keep `About me` if layout width allows

### 7.1.4 Logout

Implement blog logout to:

1. clear `betterAuthToken`
2. clear `payload-token`
3. optionally redirect through an auth-origin sign-out page to clear the Better Auth session as well

If global logout is required, mirror Payload’s pattern:

- local route clears cookies
- redirect page POSTs to `${AUTH_BASE_URL}/api/auth/sign-out`
- then returns to the blog

### 7.1.5 No Change Needed in Existing Payload Fetch Layer

Do not rewrite:

- `common/utils/auth.ts`
- `common/apis/base.ts`

They already support the desired token flow.

### 7.1.6 New Environment Variables

Add to `next-blog`:

- `AUTH_BASE_URL`
- `BLOG_CLIENT_ID`
- `BLOG_REDIRECT_URI`
- `AUTH_SHARED_COOKIE_DOMAIN` (optional but recommended)

Optional:

- `BLOG_POST_LOGOUT_REDIRECT_URI`

---

## 7.2 `auther` Changes

### 7.2.1 Add a Dedicated Blog OAuth Client

Provision a new public client:

- `BLOG_CLIENT_ID`
- public / PKCE
- `tokenEndpointAuthMethod = none`
- redirect URIs for `next-blog`
- optional post-logout redirect URIs

This can reuse the existing trusted-client/public-client model already used for the current SPA client.

### 7.2.2 Add Explicit Grant Projection Support

This is the main backend change.

#### Problem

Today, a client-owned registration context is selected by `context.clientId`, but the code does not explicitly validate whether `grants[].entityTypeId` belongs to:

- the same client
- another client
- an allowed target client

The model can technically support cross-client grants, but the behavior is implicit and dangerous.

#### Required Change

Add an explicit allowlist on OAuth client metadata.

Recommended new metadata field:

- `grantProjectionClientIds: string[]`

Suggested semantics:

- empty or missing: this client may only target its own authorization models
- non-empty: this client may target its own models plus models owned by clients in `grantProjectionClientIds`

For the blog client:

- `grantProjectionClientIds = [PAYLOAD_CLIENT_ID]`

### 7.2.3 Schema / Migration

Add a new JSON field on `oauth_client_metadata`.

Suggested field name:

- `grantProjectionClientIds`

Suggested default:

- `[]`

Tasks:

1. update Drizzle schema
2. add migration
3. update repository types and serialization
4. expose in admin read/write paths

### 7.2.4 Registration Context Validation

Update server-side creation and update logic for client contexts.

Affected areas:

- `src/app/admin/clients/[id]/registration-actions.ts`
- any platform-level context creation endpoints if they share validation logic

Required validation:

1. Resolve each `grant.entityTypeId` to its authorization model.
2. Determine the model’s owning client.
3. Allow the grant if:
   - owning client == current client, or
   - owning client is in `grantProjectionClientIds`
4. Reject otherwise.

This must be enforced server-side even if the UI already filters options.

### 7.2.5 Registration Context UI

Current UI only shows relations from the current client’s authorization model.

Affected files:

- `src/app/admin/clients/[id]/registration-actions.ts`
- `src/app/admin/clients/[id]/registration-tabs.tsx`

Replace current “current client only” relation loading with “allowed registration targets”.

Recommended new read action:

- `getRegistrationGrantTargets(clientId)`

Return grouped options:

- current client models
- projected target client models

Suggested UI labeling:

- `Payload CMS -> book -> viewer`
- `Payload CMS -> chapter -> viewer`
- `Payload CMS -> comment -> viewer`

The UI must make cross-client targeting obvious and intentional.

### 7.2.6 Keep Existing Authorize-Time Grant Application

Do not rewrite:

- `applyClientContextGrants`

It already performs the right high-level job:

- find contexts owned by the current login client
- apply each context’s grants to the authenticated user

Once validation and UI support are added, this mechanism becomes the blog-to-Payload bridge.

### 7.2.7 No New Token Mapping Endpoint

Do not add any endpoint that exchanges a `BLOG_CLIENT_ID` token for a `PAYLOAD_CLIENT_ID` token.

This is explicitly out of scope and should remain unsupported.

### 7.2.8 Optional Metrics / Audit Additions

Recommended new metrics:

- `oidc.context_projection.applied.count`
- `oidc.context_projection.denied.count`
- `registration_context.cross_client_grant.count`

Recommended audit fields on grant-creation logs:

- login client ID
- target model client ID
- context slug

---

## 7.3 `payloadcms` Changes

### 7.3.1 Accept Blog-Issued JWT Audience

This is required if Payload currently enforces audience.

Payload verifies Better Auth JWT audience in:

- `payloadcms/src/lib/betterAuth/tokens.ts`

If a blog-issued token has `aud = BLOG_CLIENT_ID`, Payload must accept it when the blog forwards that token to Payload APIs.

Recommended configuration:

- `BETTER_AUTH_JWT_AUDIENCE = PAYLOAD_CLIENT_ID,BLOG_CLIENT_ID`

Do not disable audience checking completely unless there is no safer temporary option.

### 7.3.2 Keep Payload Webhook Scope Bound to Payload Client

Do not generalize the Payload webhook endpoint to accept all clients.

Current behavior is good:

- only Payload-client-scoped tuple events should be mirrored
- other client events should continue to be ignored

Because the projected tuples are minted in the Payload namespace, they will already arrive with `clientId = PAYLOAD_CLIENT_ID`.

### 7.3.3 No Multi-Client Reconciliation Rewrite

Do not rewrite:

- `grantMirror.ts`
- reconcile endpoints
- webhook filtering

to become client-agnostic.

That would expand scope significantly and is not necessary for this design.

### 7.3.4 Fix First-Request Race on Deferred Grants

This is the most important Payload code change.

#### Current Problem

If a grant webhook arrives before the user exists in Payload:

1. Payload enqueues a deferred grant
2. Later, the user logs in through the blog
3. Payload authenticates the token and may create or link the user
4. Deferred grant drain is currently fire-and-forget

That means the first authenticated request after login can race and observe missing grants.

Affected code:

- `payloadcms/src/lib/betterAuth/users.ts`
- `payloadcms/src/utils/access.ts`

#### Required Change

Make deferred-grant drain synchronous when the user is newly linked or created through Better Auth authentication.

Recommended implementation:

1. In `upsertBetterAuthUser`, detect whether this request:
   - created a new Payload user, or
   - linked `betterAuthUserId` onto an existing email-matched user
2. If yes, synchronously call:
   - `drainDeferredGrantsForUser(payload, betterAuthUserId, payloadUserId)`
3. Await it before returning the authenticated user

This ensures the first content request after blog login can immediately see the mirrored grant state.

Keep the existing `usersAfterOperationHook` drain as a fallback, but do not rely on it for first-request correctness.

### 7.3.5 Optional: Add a Small Bootstrap Endpoint

This is optional if synchronous drain is implemented well.

Possible endpoint:

- `/api/internal/auth/bootstrap`

Behavior:

- accepts the bearer token
- forces Payload user upsert/link
- blocks until deferred grants are drained

This can be used by the blog callback before redirecting the user back into a protected page.

If synchronous drain is implemented in `upsertBetterAuthUser`, this endpoint is optional and may be skipped.

---

## 8. Data Model and Contract Changes

## 8.1 `auther` Metadata Change

Suggested new field on OAuth client metadata:

```ts
grantProjectionClientIds: string[]
```

Example for the blog client:

```json
{
  "allowsRegistrationContexts": true,
  "accessPolicy": "all_users",
  "grantProjectionClientIds": ["payload-client-id"]
}
```

## 8.2 Registration Context Semantics

A client-owned registration context means:

- this login client can trigger this context

It does **not** necessarily mean:

- all grants must remain inside that same client namespace

After this change, allowed target namespaces are:

- self
- explicit projection targets

## 8.3 Cookie Contract

The blog callback should write:

- `betterAuthToken`
- `payload-token`

These names are already compatible with:

- blog-side auth extraction
- Payload-side JWT extraction when the blog forwards cookies or bearer tokens

## 8.4 Audience Contract

If audience validation is enabled in Payload, the accepted audience list must include:

- `PAYLOAD_CLIENT_ID`
- `BLOG_CLIENT_ID`

---

## 9. End-to-End Flow After Implementation

### 9.1 Existing User

1. User visits protected book page on blog.
2. Blog redirects to `auther` using `BLOG_CLIENT_ID`.
3. User signs in.
4. `auther` applies blog-owned registration contexts.
5. Those contexts create Payload-scoped tuples.
6. Auther emits tuple webhook with `clientId = PAYLOAD_CLIENT_ID`.
7. Payload mirrors grant rows.
8. Blog callback stores `id_token` cookies.
9. Redirect back to protected book page.
10. Blog forwards token to Payload GraphQL.
11. Payload authenticates same Better Auth user and reads mirrored grants.

### 9.2 New User Not Yet Present in Payload

1. Steps 1-7 same as above.
2. Payload webhook may not find a matching Payload user yet.
3. Deferred grant is queued.
4. Blog forwards token to Payload on first authenticated request.
5. Payload creates or links the user via `betterAuthUserId`.
6. Payload synchronously drains deferred grants.
7. The same request proceeds with grants now available.

This is why the synchronous drain change is required.

---

## 10. Implementation Order

Recommended order:

1. `auther`: add `BLOG_CLIENT_ID`
2. `auther`: add metadata field `grantProjectionClientIds`
3. `auther`: add validation for projected registration context grants
4. `auther`: update registration UI to show allowed target models
5. `payloadcms`: update accepted JWT audiences
6. `payloadcms`: make deferred-grant drain synchronous on first link/create
7. `next-blog`: add login/callback/logout routes
8. `next-blog`: add header sign-in button
9. configure one blog registration context targeting Payload models
10. run end-to-end tests for:
   - existing user
   - brand new user
   - user with existing Payload row but missing `betterAuthUserId`

---

## 11. Testing Plan

## 11.1 `auther`

Add tests for:

1. blog client with `grantProjectionClientIds = [PAYLOAD_CLIENT_ID]` can create a registration context targeting Payload model IDs
2. blog client without projection rights is rejected
3. authorize flow for `BLOG_CLIENT_ID` triggers registration context grants
4. created tuples use Payload entity type namespace
5. emitted webhook `clientId` resolves to `PAYLOAD_CLIENT_ID`

## 11.2 `payloadcms`

Add tests for:

1. Payload accepts JWT audience from `BLOG_CLIENT_ID`
2. webhook for projected Payload-scoped tuple is accepted
3. webhook for non-Payload client is skipped
4. deferred grant created before user exists is applied on first authenticated request
5. first authenticated request after user creation does not race and deny access

## 11.3 `next-blog`

Add tests for:

1. `/auth/login` builds correct authorize redirect for public PKCE client
2. `/auth/callback` validates state and exchanges token
3. callback stores `betterAuthToken` and `payload-token`
4. logout clears those cookies
5. protected book flow works after blog login without prior Payload login

## 11.4 Manual End-to-End Scenarios

Must test:

1. user already known to Payload
2. user unknown to Payload
3. user exists in Payload by email but `betterAuthUserId` is empty
4. invalid state
5. expired PKCE cookie
6. bad token audience
7. projected registration context disabled
8. revoke grant after login and verify mirrored access removal

---

## 12. Risks and Failure Modes

### 12.1 First-Request Race

Risk:

- user authenticates successfully
- first protected request arrives before deferred grants are drained

Mitigation:

- synchronous drain in Payload auth upsert path

### 12.2 Over-Broad Cross-Client Grants

Risk:

- one client can mint grants into another client namespace unintentionally

Mitigation:

- explicit `grantProjectionClientIds`
- server-side validation
- UI labeling of target client

### 12.3 Audience Mismatch

Risk:

- blog token is valid at issuer level but rejected by Payload for `aud`

Mitigation:

- configure Payload to accept both client audiences

### 12.4 Shared Cookie Confusion

Risk:

- cookies set on wrong host/domain
- sign-in appears to work but SSR requests do not see the token

Mitigation:

- shared cookie helper in blog
- explicit production and localhost behavior

### 12.5 Hidden Authorization Drift

Risk:

- blog client login succeeds but projected contexts are not configured
- user appears signed in but still has no Payload content access

Mitigation:

- admin UI should show blog registration contexts clearly
- add health/admin diagnostics for projected grant counts

---

## 13. Explicit Non-Goals

The following are intentionally not part of this plan:

1. Replacing Payload’s mirror architecture with a multi-client authorization engine
2. Translating one OIDC token into another
3. Making `next-blog` a direct authorization source for Payload content
4. Using user-level `oauth_client/full_access` as the main browser-reader bridge
5. Removing Payload as the source of truth for content grants

---

## 14. Recommended Initial Implementation Slice

If work needs to be split into the smallest useful milestone, implement this exact slice first:

1. Add `BLOG_CLIENT_ID`
2. Add `grantProjectionClientIds` to OAuth client metadata
3. Allow blog contexts to target Payload model IDs
4. Configure one blog context that grants:
   - `client_<PAYLOAD_CLIENT_ID>:book -> viewer`
   - `client_<PAYLOAD_CLIENT_ID>:chapter -> viewer`
   - `client_<PAYLOAD_CLIENT_ID>:comment -> viewer`
5. Add blog login/callback storing:
   - `betterAuthToken`
   - `payload-token`
6. Add Payload audience support for `BLOG_CLIENT_ID`
7. Fix synchronous deferred-grant drain

That milestone is enough to prove the architecture before polishing UI and logout.

---

## 15. Acceptance Criteria

This plan is successfully implemented when all of the following are true:

1. `next-blog` authenticates through a dedicated public PKCE client.
2. The returned Better Auth JWT can be used by the blog without first visiting Payload.
3. Payload accepts the blog-issued JWT audience.
4. Blog-owned registration contexts can intentionally mint Payload-scoped tuples.
5. Projected grant webhooks are mirrored by Payload without making Payload multi-client aware.
6. A new user who has never existed in Payload can sign in through the blog and access granted content on the first authenticated request.
7. No token translation service exists anywhere in the flow.

---

## 16. Final Recommendation

Proceed with a dedicated blog client, but implement it as:

- **separate login client**
- **shared user identity**
- **projected Payload authorization scope**

Do not invest in token mapping. The codebase already has the pieces needed for a cleaner design, and the missing work is mostly:

- explicit projection validation in `auther`
- audience configuration in `payloadcms`
- a blog-owned PKCE callback flow
- first-request correctness in Payload deferred grant handling

