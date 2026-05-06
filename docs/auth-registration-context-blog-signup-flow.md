# Auth Registration Context, Invite, And Blog Signup Flow Review

> Status: implementation-grade flow review
>
> Date: 2026-05-06
>
> Scope:
>
> - Auther codebase: `/home/quanghuy1242/pjs/auther`
> - Blog planning docs: `/home/quanghuy1242/pjs/next-blog/docs`
>
> Related docs:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/auth-platform-registration-access-correction-plan.md`
> - `docs/auth-space-access-control-implementation-plan.md`

## 1. Goal

Define what the existing registration context and invite system is actually doing, decide whether it still belongs in an authorization-space-first model, and describe the correct first-release signup flow for a public blog user who should receive the `commenter` permission.

The short version:

- A registration context is not an authorization space.
- A registration context should be an onboarding policy: "when a user signs up through this verified source, attach these initial authorization-space grants or create these approval requests."
- The current implementation has parts of this shape, but it is incomplete and still carries old client-centric assumptions.
- The current "pending registration context application" is not an approval queue. It is a durable deferred-grant queue keyed by email, used because the user may not exist yet.
- If the desired product behavior is "user confirms email, then waits for approval", that needs either `permission_requests` or a dedicated signup approval model. It should not be confused with the current pending grant table.

## 2. Current Concepts

### 2.1 Registration Context

Current table: `registration_contexts`

Current purpose in code:

```text
slug/name/description:
  identifies a signup flow, for example blog-commenter

trigger fields:
  triggerKind
  triggerClientId
  legacy clientId

target fields:
  targetKind
  targetId

source restrictions:
  allowedOrigins
  allowedDomains

grants:
  [{ entityTypeId, relation }]
```

In the corrected model, this should mean:

```text
Registration Context = signup/onboarding policy

Example:
  slug: blog-commenter
  triggerKind: oauth_client
  triggerClientId: <blog oauth client id>
  targetKind: authorization_space
  targetId: <blog/payload authorization space id>
  grants:
    - entityTypeId: <Book model id>
      relation: commenter
```

That is a reasonable concept. What is wrong is treating the context as "owned by a client" or using `clientId = null` to mean global platform behavior. In an auth-space model, the target is the authorization space or resource model. The OAuth client can be a trigger, but it should not be the owner of the permission model.

### 2.2 Platform Invite

Current table: `platform_invites`

Current purpose:

- Stores one-time invite records for registration contexts.
- Optional email lock.
- Stores `contextSlug`.
- Stores `tokenHash`.
- Tracks `expiresAt`, `consumedAt`, `consumedBy`.

Current service: `src/lib/services/registration-context-service.ts`

Current token format:

```text
base64url(JSON.stringify({
  payload: {
    email?: string,
    contextSlug: string,
    invitedBy: string,
    expiresAt: number
  },
  random: string,
  sig: hmac_sha256(JSON.stringify(payload) + random)
}))
```

The DB stores `sig` as `tokenHash`.

This is useful for an admin-generated, one-time signup invitation. It proves "Auther minted an invite for this context", and optionally "this invite belongs to this email".

Current problem: the generated URL is:

```text
/sign-up?invite=<token>
```

There is no real `src/app/sign-up` page in Auther today. The code can mint and verify invite tokens, but the user-facing signup flow that consumes them is not implemented.

### 2.3 Pending Registration Context Application

Current table: `pending_registration_context_applications`

Current purpose:

- Queue a context grant before the user exists.
- Key by email.
- Later, after Better Auth creates the user, apply queued context grants to that new `userId`.
- Mark status as `pending`, `applied`, or `failed`.

Important: this table is not an approval queue.

The word "pending" here means:

```text
The user account does not exist yet, so store the grant request by email and apply it after user creation.
```

It does not mean:

```text
The user confirmed email and is waiting for admin approval.
```

If the blog signup flow should create a pending access request after email verification, use `permission_requests` or create a dedicated `signup_access_requests` table. Do not overload this queue.

## 3. Current Runtime Flow

### 3.1 Invite Creation

Admin path:

- `src/app/admin/users/invites-actions.ts`
- `createInvite()`
- calls `registrationContextService.createSignedInvite()`

Actual behavior:

1. Admin chooses a registration context.
2. Auther loads the context by slug.
3. Auther checks that the context is enabled.
4. If the legacy `context.clientId` is set, Auther checks `oauth_client_metadata.allows_registration_contexts`.
5. Auther signs a token.
6. Auther stores a `platform_invites` row.
7. Auther returns `/sign-up?invite=<token>`.

Problems:

- Context selection currently uses `registrationContextRepo.findPlatformContexts()`.
- `findPlatformContexts()` means `clientId IS NULL`.
- After the auth-space correction, many valid auth-space-targeted contexts also have `clientId = null`.
- So the invite UI can accidentally list too many contexts, not only true global platform signup flows.
- The generated `/sign-up` URL has no matching page.

### 3.2 Invite Verification

Route:

- `src/app/api/auth/verify-invite/route.ts`

Request:

```json
{
  "token": "...",
  "email": "reader@example.com"
}
```

Actual behavior:

1. Decode token.
2. Verify HMAC signature.
3. Check token expiry from payload.
4. Load invite by token hash.
5. Reject consumed invite.
6. If token was email-locked, reject different email.
7. Load registration context.
8. Reject disabled context.
9. Queue pending context application by email.
10. Queue all "platform contexts".
11. Return `{ valid: true, contextSlug }`.

Important problem:

Step 10 calls `queuePlatformContextGrants(email)`, which uses `findPlatformContexts()`. Because `findPlatformContexts()` currently only checks `clientId IS NULL`, an invite signup can over-grant unrelated auth-space-targeted contexts. This must be fixed before enabling public signup.

### 3.3 User Creation

Better Auth hook:

- `src/lib/pipelines/auth-hooks.ts`
- `databaseHooks.user.create.after`

Actual behavior:

1. Better Auth creates the user row.
2. `applyRegistrationContextGrants(user.id, user.email)` runs.
3. It finds all pending context applications by normalized email.
4. For each pending row, it loads the registration context.
5. It applies all configured grants.
6. If the pending row had an invite, it marks the invite consumed.
7. It marks the pending application as `applied`.

Important timing issue:

Auther config has `requireEmailVerification = true` and `sendOnSignUp = true`, but the registration context grants are applied in `user.create.after`. That means grants are applied at account creation time, not after verified email.

If the desired behavior is "email confirmed first, then grant or request access", this hook is too early.

### 3.4 Signup Endpoint Restriction

Current sign-up API access is intentionally blocked for normal browser callers.

Files:

- `src/lib/auth.ts`
- `src/lib/utils/auth-middleware.ts`

Restricted paths:

```text
/sign-up/email
/oauth2/register
```

These paths require header:

```text
x-internal-signup-secret: <INTERNAL_SIGNUP_SECRET>
```

This means public blog signup cannot safely call Better Auth's sign-up endpoint directly. A browser must never receive `INTERNAL_SIGNUP_SECRET`.

The correct shape is an Auther-owned server action or route:

```text
POST /sign-up/blog
  validates invite/source token
  queues or records signup intent
  calls Better Auth signUpEmail server-side with INTERNAL_SIGNUP_SECRET
  handles email verification and redirect state
```

## 4. What Registration Context Is For

Registration context is still useful if it is reframed correctly.

It should answer:

```text
Why is this new user allowed to request or receive an initial permission grant?
```

Examples:

- "This user came from the blog OAuth client."
- "This user used an admin-minted invite for blog commenter."
- "This user came from an approved partner domain."
- "This user is being manually onboarded by an admin."

It should not answer:

- "Which client owns this authorization model?"
- "Which OAuth client is the permission boundary?"
- "Is this user approved after signup?"

Those are different concepts.

The target permission boundary should be the authorization space:

```text
Blog signup flow
  trigger: blog OAuth client or invite token
  target: blog/payload authorization space
  grant/request: Book commenter, Comment author, Profile viewer, etc.
```

## 5. Blog Signup Target Flow

### 5.1 Product Requirement

When a user starts signup from the blog:

1. Blog sends the user to Auther.
2. Auther can tell the signup was initiated by the blog.
3. The user signs up or verifies email in Auther.
4. Auther creates an Auther user.
5. Auther gives or requests blog-specific permissions.
6. User returns to the blog OAuth/login flow.
7. Blog sees an authenticated user with the expected authorization-space grants.

### 5.2 Recommended URL Shape

For a public blog signup entry:

```text
https://auther.example.com/sign-up
  ?flow=blog-commenter
  &token=<signed_signup_intent_or_invite>
  &return_to=<encoded_blog_url_or_oauth_authorize_url>
  &theme=blog
```

For a strict admin invite:

```text
https://auther.example.com/sign-up
  ?invite=<one_time_invite_token>
  &return_to=<encoded_blog_url_or_oauth_authorize_url>
  &theme=blog
```

Do not rely on `allowedOrigins` alone. Origin and Referer headers are useful as defense-in-depth, but they are not a durable authorization proof for signup.

### 5.3 Signup Intent Token

For self-serve blog signup, use a signed signup intent token instead of a reusable context slug.

Token claims should include:

```json
{
  "kind": "signup_intent",
  "flow": "blog-commenter",
  "triggerKind": "oauth_client",
  "triggerClientId": "<blog-client-id>",
  "targetKind": "authorization_space",
  "targetId": "<blog-auth-space-id>",
  "requestedGrants": [
    {
      "entityTypeId": "<book-model-id>",
      "entityId": "*",
      "relation": "commenter"
    }
  ],
  "email": null,
  "returnTo": "https://blog.example.com/...",
  "nonce": "...",
  "expiresAt": 1778000000000
}
```

The server must verify:

- token signature
- expiry
- nonce/replay state if the token is one-time
- `flow` maps to an enabled registration context
- `triggerClientId` is allowed to trigger that context
- `targetId` matches the context target authorization space
- requested grants are a subset of the context grant policy
- `returnTo` is allowed for the blog client

### 5.4 Auto-Grant Variant

Use this when blog signup should immediately allow a basic permission after email verification.

Flow:

1. Blog redirects to Auther `/sign-up`.
2. Auther validates invite or signup intent token.
3. User enters email/password.
4. Auther creates user via a server-side signup action.
5. Auther sends verification email.
6. User verifies email.
7. Auther applies registration context grants.
8. Auther redirects back to OAuth authorize or the blog.

Required implementation detail:

Grant application must include authorization-space scope:

```text
authorizationSpaceId: <blog-auth-space-id>
entityTypeId: <book/comment/profile model id>
entityType: <current canonical entity type name>
entityId: "*"
relation: "commenter"
subjectType: "user"
subjectId: <new user id>
```

Current code in `applyContextGrants()` uses `entityTypeId`, `entityType`, `entityId`, `relation`, and subject fields, but it does not pass `authorizationSpaceId`. That should be corrected before this flow is enabled.

### 5.5 Approval-Pending Variant

Use this when blog signup should not immediately grant access.

Flow:

1. Blog redirects to Auther `/sign-up`.
2. Auther validates invite or signup intent token.
3. User enters email/password.
4. Auther creates user via a server-side signup action.
5. User verifies email.
6. Auther creates a permission request instead of creating access tuples.
7. Admin or automation approves the request.
8. Approval creates the actual access tuples.
9. User can then return to the blog and access the authorized feature.

Use `permission_requests` if it already supports the target shape:

```text
requestKind: authorization_space
targetKind: authorization_space
targetId: <blog-auth-space-id>
targetEntityTypeId: <book/comment/profile model id>
targetEntityId: "*"
requestedRelation: "commenter"
status: pending
```

If signup approval needs richer state, create a dedicated table:

```text
signup_access_requests:
  id
  userId
  email
  flowSlug
  inviteId
  targetKind
  targetId
  requestedGrantsJson
  status: pending | approved | rejected | expired
  createdAt
  reviewedAt
  reviewedBy
  decisionReason
```

Do not use `pending_registration_context_applications` for human approval. Its current semantics are "deferred system application", not "waiting for decision".

## 6. Required Auther Changes Before Blog Signup

### 6.1 Add A Real Signup Page

Add a user-facing page:

```text
src/app/sign-up/page.tsx
```

It must handle:

- `invite`
- `flow`
- `token`
- `return_to`
- `theme=blog`
- already signed-in users
- expired/consumed/invalid invite states
- email-locked invite states
- OAuth authorize continuation

It should not expose `INTERNAL_SIGNUP_SECRET` to the browser.

### 6.2 Add A Server-Side Signup Action Or Route

Add an Auther-owned action or route that:

1. Validates the invite or signup intent token.
2. Validates email restrictions.
3. Queues grant application or creates approval request.
4. Calls Better Auth signup internally with `INTERNAL_SIGNUP_SECRET`.
5. Stores continuation state for post-verification redirect.

The browser submits to this Auther route. This route calls Better Auth internally.

### 6.3 Move Grant Timing If Email Verification Is Required

Current grants apply on `user.create.after`, before verified email.

For blog signup, choose one:

- Keep immediate apply only for trusted admin-created users.
- Move public signup grant application to post-email-verification.
- Or create permission request after verification and only grant after approval.

The safer public behavior is:

```text
signup intent validated -> user created -> email verified -> grant/request applied
```

### 6.4 Fix Platform Context Lookup

Replace ambiguous lookup:

```text
findPlatformContexts(): clientId IS NULL
```

with explicit lookups:

```text
findGlobalPlatformContexts():
  targetKind = "platform"
  targetId = "*"
  triggerKind = "platform"

findContextsForTriggerClient(clientId):
  triggerKind = "oauth_client"
  triggerClientId = clientId

findContextsForAuthorizationSpace(spaceId):
  targetKind = "authorization_space"
  targetId = spaceId
```

Then update:

- invite context picker
- `queuePlatformContextGrants()`
- platform access page
- client registration tabs
- admin user creation context selection

### 6.5 Stop Blindly Queueing All Platform Contexts

`verify-invite` currently queues the invite context and then queues every "platform context".

That is dangerous in the corrected model.

Correct behavior:

- If a context explicitly includes baseline grants, apply those grants from that context.
- If there is a true global baseline context, it must be explicitly marked as global baseline.
- Do not infer baseline grants from `clientId = null`.

### 6.6 Enforce Email Domain Restrictions

`allowedDomains` exists in the schema, but current invite validation and origin validation do not enforce it.

Before enabling public signup:

- Normalize email to lowercase.
- Extract domain after the last `@`.
- Compare against context `allowedDomains`.
- Decide whether subdomains are allowed.
- Reject disposable or blocked domains if that is a product requirement.

### 6.7 Fix Auth-Space Scoped Grant Creation

`registrationContextService.applyContextGrants()` must create tuples with the model's `authorizationSpaceId`.

Expected tuple fields:

```text
authorizationSpaceId: model.authorizationSpaceId
entityTypeId: model.id
entityType: model.entityType
entityId: "*"
relation: grant.relation
subjectType: "user"
subjectId: userId
```

If `model.authorizationSpaceId` is missing, fail closed. Do not create unscoped tuples for auth-space resources.

### 6.8 Replace Client-Centric Guard Checks

Current code still checks `context.clientId` and `oauth_client_metadata.allows_registration_contexts`.

Target behavior:

- For OAuth-client-triggered signup, check `triggerClientId`.
- The trigger client must be allowed to trigger signup contexts.
- The trigger client must be linked to the target authorization space or explicitly granted `can_trigger_contexts`.
- The grant target must be in the context target authorization space.

The OAuth client is the caller/trigger, not the data-model owner.

### 6.9 Store Return/OAuth Continuation State

The signup flow must know where to send the user after:

- account creation
- email verification
- approval pending
- approval success

Recommended state:

```text
signup_continuations:
  id
  nonce
  userId nullable
  email
  flowSlug
  inviteId nullable
  returnTo
  oauthAuthorizeParamsJson nullable
  status: pending_email | pending_approval | ready | consumed | expired
  expiresAt
  createdAt
  updatedAt
```

Without this, email verification can strand the user in Auther instead of returning to the blog.

### 6.10 Preserve Payload Grant Mirror Propagation

The first-release signup work must include the PayloadCMS mirror path. The blog uses Payload's local `grant-mirror` read model for private books, sharing, and other content access checks. Creating the Auther tuple is not enough if Payload never receives or applies the grant event.

Target model:

```text
Auther authorization space = canonical grant boundary
PayloadCMS grant-mirror = local projection for one authorization space
Payload OAuth client / Blog OAuth client = login clients, not mirror scopes
```

In the corrected model, Payload should mirror by `authorizationSpaceId`. It should not mirror by OAuth client ID. OAuth clients initiate login or signup; authorization spaces own resource models and grants.

Current PayloadCMS behavior in `/home/quanghuy1242/pjs/payloadcms`:

- `src/app/api/webhooks/auther/route.ts` receives `grant.created` and `grant.revoked`.
- `grant.created` resolves the Better Auth user to a Payload user and upserts `grant-mirror`.
- If the Payload user does not exist yet, it enqueues `deferred-grants`.
- `src/lib/betterAuth/users.ts` drains deferred grants when a Payload user is created or newly linked.
- `src/app/api/internal/reconcile/route.ts` can repair missed mirror rows.
- Payload supports authorization-space routing when `AUTHER_USE_SPACE_ROUTING=true` and `AUTHER_AUTHORIZATION_SPACE_ID` is set.

Current Auther behavior:

- `TupleRepository.create()` emits `grant.created` for user/group tuples.
- The event payload includes `authorizationSpaceId`.
- `registrationContextService.applyContextGrants()` uses `tupleRepo.createIfNotExists()`, so onboarding grants should emit `grant.created` when a tuple is newly created.

Gaps to cover in the implementation ticket:

- Auther webhook delivery still filters subscribers by `clientId`; a space-native grant may have `clientId = null`. The target fix is authorization-space-scoped webhook endpoint filtering. Payload subscribing with an unscoped endpoint and self-filtering by `authorizationSpaceId` is acceptable only as a temporary migration fallback.
- Auther webhook endpoint/subscription records should support:

```text
scopeKind: global | oauth_client | authorization_space
scopeId: null | <clientId> | <authorizationSpaceId>
```

- Grant delivery should send `grant.created` / `grant.revoked` events to:

```text
global grant subscribers
authorization_space subscribers where scopeId = event.authorizationSpaceId
legacy oauth_client subscribers only for legacy client-scoped events during migration
```

- Payload's webhook receiver must accept the entity type shape emitted by Auther for space-native models. If Auther emits canonical names such as `space_<spaceId>:book`, Payload's parser must strip the space prefix. If Auther emits raw names such as `book`, Payload's current space-routing parser can accept it.
- Payload must be configured with the target content authorization space:

```text
AUTHER_USE_SPACE_ROUTING=true
AUTHER_AUTHORIZATION_SPACE_ID=<blog/payload content authorization space id>
AUTHER_WEBHOOK_SECRET=<same signing secret as Auther endpoint>
AUTHER_API_KEY=<Auther space service-account key with authorization_space_id metadata for this space>
```

- The first public signup redirect should not happen until the Auther-side grant is created and the webhook has at least been queued for delivery, or Payload must have a deterministic bootstrap path on first login.
- Existing users need special care: if `createIfNotExists()` finds an existing tuple, no new `grant.created` event is emitted. If Payload has no mirror row for that tuple, the flow must trigger reconciliation, list-object bootstrap, or a dedicated mirror repair path.
- Payload should mirror all mirrorable resource grants for its configured authorization space, not only blog-signup-created grants. Today the mirrorable entity types are `book`, `chapter`, and `comment`.

## 7. Blog Flow Recommendation

For this release, use one public blog onboarding flow.

### 7.1 Blog Commenter

Use this when a public user signs up from the blog and should receive the first blog permission.

```text
flow slug: blog-commenter
display name: Blog Commenter
triggerKind: oauth_client
triggerClientId: <blog oauth client id>
targetKind: authorization_space
targetId: <blog auth space id>
entry: signed signup intent from the blog
grant policy:
  <blog model> commenter on "*"
apply mode: auto_after_email_verification
```

Important prerequisite:

```text
The blog authorization-space data model must define the commenter relation before this onboarding flow can be registered.
```

The reviewed code suggests `commenter` is not currently present on the relevant model. That means the first implementation step is not the signup page; it is updating the blog auth-space model so `commenter` exists as a normal relation. After the relation exists, the onboarding flow can reference the model's stable `entityTypeId` and the `commenter` relation.

For the first release, do not add mixed auto/request grant modes. The current registration context `grants` shape is enough if the only target permission is auto-granted `commenter`.

### 7.2 Deferred Viewer/Admin Split

Earlier versions of this plan suggested separate `viewer` and `commenter` flows. That is not needed for the first release.

Future expansion can add:

- a `viewer` relation if the blog needs read access distinct from anonymous/public reads
- a `member` or `profile_owner` relation for logged-in profile features
- an admin promotion path through platform access or permission requests

Do not add those relations just to make the first signup flow look more general. Start with the actual needed permission: `commenter`.

## 8. Edge Cases

### 8.1 User Already Exists

If an invited email already has an account:

- Do not create a second user.
- Validate the invite against the existing user's email.
- Apply grants or create a permission request for the existing user.
- Consume the invite only after the grant/request operation succeeds.
- Redirect into OAuth authorize for the blog.

### 8.2 User Starts Signup With One Email And Verifies Another

If invite is email-locked:

- The signup email must exactly match after normalization.
- If Better Auth allows account email changes before verification, re-check before applying grants.

### 8.3 Invite Reuse

Current invite consumption happens after grant application. Keep that.

Also handle:

- two tabs submitting the same invite
- user refresh after account creation
- retry after failed email verification
- retry after failed tuple creation

Use DB idempotency keys and transactions where possible.

### 8.4 Signup Intent Replay

Self-serve blog signup tokens should have:

- short expiry
- nonce
- replay record if they grant anything directly

If the token only selects a public flow and all grants are low-risk, replay may be acceptable. If it carries email or grant details, make it one-time.

### 8.5 Disabled Context After Invite Was Created

Current validation rejects disabled contexts. Keep that behavior.

User-facing page should show:

```text
This signup link is no longer active.
```

Do not leak whether the email exists.

### 8.6 Deleted Or Renamed Authorization Model

Current grants reference `entityTypeId`, which is good.

Before applying:

- load model by ID
- ensure model still exists
- ensure relation still exists
- ensure model belongs to expected `authorizationSpaceId`
- fail closed if any check fails

### 8.7 Existing Pending Application

Current idempotency key:

```text
<email>:<contextSlug>:<inviteId or open>
```

This prevents duplicate pending rows for the same email/context/invite.

If adding approval state, do not reuse the same idempotency key unless the approval semantics match. Approval requests need separate uniqueness rules.

### 8.8 Email Verification Timing

Current grants happen too early for public signup.

If grants must wait for verification:

- either hook into Better Auth verification update
- or check verification status on first post-verification session
- or run a post-verification continuation route

Do not depend on the user manually returning to the blog to finish critical grant application.

### 8.9 Open Origin Contexts

Current `validateOriginForContext()` supports exact origins, `*`, and wildcard subdomains.

Problems:

- It is not wired into signup.
- It trusts headers that are not enough for granting permissions.
- Wildcard support has subtle matching risks.
- It does not enforce `allowedDomains`.

Use signed intent tokens for blog signup. Treat origin validation as defense-in-depth only.

### 8.10 Admin User Creation

Admin user creation currently records a consumed pseudo-invite for context tracking, but the reviewed code path does not clearly apply registration context grants from that selected context.

Before relying on admin-created users with contexts:

- verify whether policy templates grant access separately
- otherwise apply the context grants explicitly
- keep tracking separate from grant application

## 9. Recorded Decisions

These decisions are now settled for the first blog signup release. The backlog should be read against this section, not as an open menu of possible flows.

### 9.1 Decision A: Auto-Grant Or Approval

Decision:

```text
Auto-grant after email verification.
The first release only needs commenter.
```

Why:

- The blog signup path is public.
- The user should be able to sign up and become a commenter without admin review.
- There is no first-release `viewer` split.

Implementation impact:

- The blog auth-space model must define `commenter` before the onboarding flow is created.
- The existing registration context `grants` JSON can represent this because it is an automatic grant.
- Grant application should still wait until email verification for public signup.
- Approval UI is not required for the first release.

### 9.2 Decision B: Approval Storage

Decision:

```text
Use permission_requests for future approval flows.
Keep permission requests scoped to authorization spaces.
```

Implementation impact:

- No approval request is needed for first-release public blog commenter signup.
- Future approval work should use `requestKind = authorization_space`, `targetKind = authorization_space`, and `targetId = <space id>`.
- Do not create a separate signup approval table unless `permission_requests` cannot hold needed lifecycle state later.

### 9.3 Decision C: Signup Token Type

Decision:

```text
Use public self-serve signed signup intent.
Do not use admin invites for the normal blog signup path.
```

Implementation impact:

- Signup intent means the blog initiated an allowed flow for a public user.
- Do not let a bare context slug grant permissions.
- Admin invites can remain in the system for other manual onboarding flows, but they are not in the first blog signup path.

### 9.4 Decision D: Baseline Platform Grants

Decision:

```text
For this release, no broad platform/admin grants.
New public users should only be able to reach /admin/profile inside Auther.
```

Implementation impact:

- Remove the current blind `queuePlatformContextGrants()` behavior from invite/signup flows.
- Ensure the Auther admin shell allows a minimum authenticated user to view only their own profile page.
- Do not grant platform admin, user management, client management, model management, or access-control permissions during blog signup.
- Add a future promotion path for turning a minimum user into a platform/admin user.

### 9.5 Decision E: Naming

Decision:

```text
Use "Onboarding Flow" in product/UI/docs.
```

Implementation impact:

- The DB table can remain `registration_contexts` for now.
- User-facing/admin-facing labels should say "Onboarding Flow".
- Code can migrate names gradually if the implementation touches those modules anyway.

### 9.6 Decision F: Payload Mirror Scope

Decision:

```text
PayloadCMS mirrors by authorization space, not OAuth client.
```

Implementation impact:

- Payload's configured content space becomes the mirror boundary.
- Auther should deliver grant webhooks to authorization-space-scoped subscribers.
- Payload should accept only events where `authorizationSpaceId` matches its configured content space.
- Payload should skip events for all other authorization spaces.
- Blog and Payload OAuth clients remain login/client surfaces. They must not decide which grants Payload mirrors.
- Legacy client-scoped webhook routing can remain only as migration compatibility.

## 10. Implementation Backlog

### 10.1 First Release: Public Blog Commenter Signup

This is the concrete first implementation path based on the recorded decisions.

- Add `commenter` relation to the relevant blog authorization-space model.
- Add real `/sign-up` page in Auther.
- Add server-side signup action/route that can call Better Auth with `INTERNAL_SIGNUP_SECRET`.
- Fix `applyContextGrants()` to include `authorizationSpaceId`.
- Replace `findPlatformContexts()` usage with explicit target/trigger queries.
- Remove blind `queuePlatformContextGrants()` from signup/invite verification paths.
- Enforce `allowedDomains`.
- Require non-default `INVITE_HMAC_SECRET` in production.
- Make invite validation and grant application fail closed when the target authorization model or relation no longer exists.
- Create `blog-commenter` signup flow targeted at the blog authorization space.
- Add signed signup intent minting/verification for blog-initiated public signup.
- Include flow slug, trigger client, target auth space, requested grant subset, return URL, nonce, and expiry.
- Store nonce/replay state if the token can grant access.
- Store return/OAuth continuation state.
- Add email verification completion handling that applies `commenter`.
- Add authorization-space-scoped webhook endpoint/subscription filtering in Auther.
- Register/configure Payload's webhook endpoint as scoped to the blog/payload content authorization space.
- Verify the `commenter` tuple emits or otherwise triggers Payload mirror propagation.
- Configure Payload's Auther webhook endpoint for authorization-space routing, not client-owned routing.
- Update Payload's mirror parser if space-native webhook events use canonical entity names such as `space_<spaceId>:book`.
- Add a deterministic mirror bootstrap for existing users when the tuple already exists and no new `grant.created` event is emitted.
- Redirect verified users back to OAuth authorize or the blog return URL.
- Handle existing users by applying `commenter` without creating a duplicate account.
- Ensure a newly signed-up public user can only access `/admin/profile` in Auther unless promoted later.

### 10.2 Payload Mirror Verification

This is a first-release acceptance gate, not a later hardening task.

- Auther emits `grant.created` with `authorizationSpaceId = <blog/payload content space id>`.
- Auther delivers that event to authorization-space-scoped webhook subscribers for the matching space.
- Auther does not require a legacy `clientId` on the grant event for Payload delivery.
- Payload webhook route accepts that event when `AUTHER_USE_SPACE_ROUTING=true`.
- Payload rejects/skips events for other authorization spaces.
- Payload mirrors direct user `commenter` grants into `grant-mirror`.
- Payload mirrors all supported resource-grant events for the configured authorization space, not just onboarding-created tuples.
- If the Payload user does not exist yet, Payload writes `deferred-grants`.
- When the user first logs into Payload/blog, the Payload user is created or linked and deferred grants are drained before access is checked.
- Private-book or sharing checks read the mirrored grant successfully.
- Reconciliation can repair a missed webhook without creating duplicate mirror rows.

### 10.3 Future Approval Flow

This is not part of first-release blog signup, but the decision is recorded for later.

- Keep approval requests in `permission_requests`.
- Keep approval request targets scoped to authorization spaces.
- Confirm `permission_requests` supports `requestKind = authorization_space`.
- Confirm it supports `targetKind = authorization_space`.
- Confirm it stores `targetId = <blog auth space id>`.
- Confirm it stores `targetEntityTypeId`, `targetEntityId`, and requested relation.
- Add signup-source metadata only if needed.
- Add approval action that creates authorization-space-scoped tuples and follows the same Payload mirror propagation requirements.

### 10.4 Minimum User And Platform Promotion Backlog

For this release, public blog signup should create a normal minimum user. If that user signs into Auther directly, they should only see `/admin/profile`.

Target minimum-user behavior:

- authenticated session is allowed
- `/admin/profile` is visible
- platform admin pages are hidden or forbidden
- users page is forbidden
- clients page is forbidden
- authorization-space management is forbidden
- model builder is forbidden
- access-control pages are forbidden
- service account management is forbidden
- API key/client management is forbidden unless separately granted later

Promotion path to add later:

- Add a platform role or platform access grant for `platform_member` if a broader logged-in baseline is needed.
- Add a platform admin promotion action that grants platform/admin relations intentionally.
- Add a profile/admin UI section showing current platform grants.
- Add a request flow where a minimum user can request admin/platform access if that product behavior is wanted.
- Use `permission_requests` for platform promotion requests with `requestKind = platform`, `targetKind = platform`, and `targetId = *`.
- Keep platform promotion separate from blog commenter onboarding. Blog signup must not imply Auther admin access.

Infrastructure note:

```text
Auther already has platform access concepts, permission requests, permission rules, and policy templates.
Those should be used for later promotion flows, but they should not be mixed into the first public blog onboarding flow.
```

### 10.5 Cleanup And Naming

These should happen alongside or after the first functional path:

- Rename registration context in UI to "Onboarding Flow".
- Keep table name if migration cost is high, but update UI/domain language.
- Remove legacy `clientId` semantics from context creation.
- Replace `allowsRegistrationContexts` with auth-space/trigger permission checks.
- Audit old invite URLs and invalidate if target semantics changed.

## 11. Final Model

The concept should stay, but the meaning should be tightened:

```text
Registration Context / Onboarding Flow:
  pre-user onboarding policy
  verifies signup source
  targets an authorization space
  grants first-release commenter access after email verification

Invite:
  one-time proof that Auther/admin allowed this signup flow for this email/context
  not used by the normal first-release public blog signup path

Pending Context Application:
  technical deferred grant queue for a user that does not exist yet
  not an approval queue

Permission Request:
  future human/automation approval queue for authorization-space or platform promotion requests
```

For the blog, the right pattern is not "client-owned access". The right pattern is:

```text
Blog OAuth client triggers signup.
Blog authorization space owns the resource model.
Onboarding flow maps verified signup source to the commenter grant policy.
Email verification gates the public commenter grant.
PayloadCMS mirrors supported resource grants for that authorization space.
Platform/admin promotion remains a separate future flow.
```
