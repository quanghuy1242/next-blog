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

Define what the existing registration context and invite system is actually doing, decide whether it still belongs in an authorization-space-first model, and describe the correct signup flow for a blog user who should receive blog permissions such as `viewer` or `commenter`.

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

## 7. Blog Flow Recommendation

For the blog, use two flows:

### 7.1 Blog Viewer

Use for basic account signup if the user only needs read access.

```text
flow slug: blog-viewer
triggerKind: oauth_client
triggerClientId: <blog oauth client id>
targetKind: authorization_space
targetId: <blog auth space id>
grant policy:
  Book viewer on "*"
  Comment viewer on "*"
apply mode: auto_after_email_verification
```

### 7.2 Blog Commenter

Use when the user should be able to write comments.

```text
flow slug: blog-commenter
triggerKind: oauth_client
triggerClientId: <blog oauth client id>
targetKind: authorization_space
targetId: <blog auth space id>
grant/request policy:
  Book viewer on "*"
  Comment viewer on "*"
  Comment commenter on "*"
apply mode:
  auto_after_email_verification if comments are open
  approval_request_after_email_verification if comments require approval
```

If commenting has moderation risk, prefer approval request for `commenter` while auto-granting `viewer`.

That means a single context may need a grant plan with modes:

```json
[
  { "entityTypeId": "<book>", "relation": "viewer", "mode": "auto" },
  { "entityTypeId": "<comment>", "relation": "viewer", "mode": "auto" },
  { "entityTypeId": "<comment>", "relation": "commenter", "mode": "request" }
]
```

The current `grants` schema cannot represent `mode`. It only represents automatic grants. If mixed auto/request behavior is needed, extend the schema or add a separate signup policy table.

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

## 9. Decisions Before Implementation

The backlog below should not be read as "start anywhere". There are a few product decisions that must be made first because they change the schema, UI, and grant timing.

### 9.1 Decision A: Auto-Grant Or Approval

Question:

```text
After a blog user verifies email, should Auther create access tuples immediately, or create an approval request first?
```

Recommended answer:

```text
viewer: auto-grant after email verification
commenter: start with approval request unless the blog explicitly wants open comments
```

Why:

- `viewer` is low risk and should not require manual admin work.
- `commenter` creates write capability and may need moderation.
- This lets signup feel normal while still protecting higher-risk permissions.

Implementation impact:

- If `commenter` is auto-granted, the existing registration context grant model can work after fixes.
- If `commenter` requires approval, the current `grants` JSON is not enough because it only represents automatic grants. Add request-mode support.

### 9.2 Decision B: Approval Storage

Only needed if any signup permission requires approval.

Question:

```text
Should signup approval use existing permission_requests or a dedicated signup_access_requests table?
```

Recommended answer:

```text
Use permission_requests first if it can represent the exact authorization-space target.
Only add signup_access_requests if signup needs extra lifecycle state that permission_requests cannot hold cleanly.
```

Implementation impact:

- Using `permission_requests` is smaller and keeps access approval in one queue.
- A dedicated signup table is cleaner if the product needs invite metadata, onboarding state, reviewer notes, resend behavior, or multi-step approval.

### 9.3 Decision C: Signup Token Type

Question:

```text
Should the blog start signup with an admin invite token, a self-serve signed signup intent, or both?
```

Recommended answer:

```text
Support both, but implement self-serve signed signup intent for normal blog signup first.
Keep admin invite for manually invited users.
```

Implementation impact:

- Invite token means an admin created a one-time invitation.
- Signup intent means the blog initiated an allowed flow for a public user.
- Do not let a bare context slug grant permissions.

### 9.4 Decision D: Baseline Platform Grants

Question:

```text
Should every new user receive any global Auther/platform grant?
```

Recommended answer:

```text
No implicit baseline grants for blog signup unless a specific global baseline context is explicitly created.
```

Implementation impact:

- Remove the current blind `queuePlatformContextGrants()` behavior from invite/signup flows.
- If a global baseline is needed later, model it explicitly as `targetKind = platform`, `targetId = *`, and `triggerKind = platform`.

### 9.5 Decision E: Naming

Question:

```text
Should the product/UI continue saying registration context?
```

Recommended answer:

```text
Use "Signup Flow" or "Onboarding Flow" in UI/docs. Keep the table name for now if migration cost is not worth it.
```

Implementation impact:

- This is mostly UI/domain language.
- It does not need to block the first implementation unless UI copy is being rebuilt.

## 10. Implementation Backlog

### 10.1 Unblocked Now: Correctness Before Any Public Signup

These are not product-choice dependent. Do them before exposing signup.

- Add real `/sign-up` page in Auther.
- Add server-side signup action/route that can call Better Auth with `INTERNAL_SIGNUP_SECRET`.
- Fix `applyContextGrants()` to include `authorizationSpaceId`.
- Replace `findPlatformContexts()` usage with explicit target/trigger queries.
- Remove blind `queuePlatformContextGrants()` from invite verification.
- Enforce `allowedDomains`.
- Require non-default `INVITE_HMAC_SECRET` in production.
- Make invite validation and grant application fail closed when the target authorization model or relation no longer exists.

### 10.2 Blocked By Decision A: Grant Timing And Mode

If the answer is auto-grant:

- Apply selected grants only after email verification.
- Keep pending registration context applications as a deferred technical queue.
- Mark invite consumed only after tuple creation succeeds.

If the answer is approval request:

- Create permission request after email verification.
- Do not create the write-level access tuple until approval.
- Mark invite consumed after request creation succeeds, or keep it reserved until approval depending on product expectation.

Recommended implementation for blog:

- Auto-grant `viewer` after email verification.
- Create approval request for `commenter`.

### 10.3 Blocked By Decision B: Approval Data Model

If using `permission_requests`:

- Confirm it supports `requestKind = authorization_space`.
- Confirm it supports `targetKind = authorization_space`.
- Confirm it stores `targetId = <blog auth space id>`.
- Confirm it stores `targetEntityTypeId`, `targetEntityId`, and requested relation.
- Add signup-source metadata if needed.

If creating `signup_access_requests`:

- Add table and repository.
- Store `flowSlug`, `inviteId`, target grant plan, status, reviewer, decision reason, and expiry.
- Add conversion from approved signup request to authorization-space-scoped tuples.

### 10.4 Blocked By Decision C: Blog Entry Token

If using self-serve signup intent:

- Add signed signup intent minting/verification.
- Include flow slug, trigger client, target auth space, requested grant subset, return URL, nonce, and expiry.
- Store nonce/replay state if the token can grant or request access.

If using only admin invite:

- Keep `platform_invites`, but rename UI language away from "platform" where the invite targets an auth space.
- Ensure invite context picker only lists contexts appropriate for the selected target.

Recommended implementation for blog:

- Implement self-serve signed signup intent first.
- Keep admin invite as a separate manually invited flow.

### 10.5 Blog Signup Flow Implementation

After Decisions A-D are answered:

- Create `blog-viewer` signup flow targeted at the blog authorization space.
- Create `blog-commenter` signup flow targeted at the blog authorization space.
- Store return/OAuth continuation state.
- Add email verification completion handling that applies grants or creates requests.
- Redirect verified users back to OAuth authorize or the blog return URL.
- Handle existing users by applying/requesting access without creating a duplicate account.

### 10.6 Cleanup And Naming

These should happen after the functional path is clear:

- Rename registration context in UI to "Signup Flow" or "Onboarding Flow".
- Keep table name if migration cost is high, but update UI/domain language.
- Remove legacy `clientId` semantics from context creation.
- Replace `allowsRegistrationContexts` with auth-space/trigger permission checks.
- Audit old invite URLs and invalidate if target semantics changed.

## 11. Final Model

The concept should stay, but the meaning should be tightened:

```text
Registration Context / Signup Flow:
  pre-user onboarding policy
  verifies signup source
  targets an authorization space
  grants low-risk access or creates approval requests

Invite:
  one-time proof that Auther/admin allowed this signup flow for this email/context

Pending Context Application:
  technical deferred grant queue for a user that does not exist yet
  not an approval queue

Permission Request:
  human/automation approval queue for access that should not be granted automatically
```

For the blog, the right pattern is not "client-owned access". The right pattern is:

```text
Blog OAuth client triggers signup.
Blog authorization space owns the resource model.
Signup flow maps verified signup source to viewer/commenter grant policy.
Email verification gates public grants.
Approval request gates higher-risk grants if required.
```
