# Blog And Payload Public Signup Integration Plan

> Status: implementation-grade architecture and backlog
>
> Date: 2026-05-07
>
> Prerequisite:
>
> - `docs/auth-registration-context-blog-signup-flow.md` is complete through `12. Definition Of Done`.
>
> Scope:
>
> - Blog frontend: `/home/quanghuy1242/pjs/next-blog`
> - PayloadCMS app and content API: `/home/quanghuy1242/pjs/payloadcms`
> - Auther admin/data setup only where needed to wire the already-built generic signup engine.
>
> Related docs:
>
> - `docs/auth-registration-context-blog-signup-flow.md`
> - `docs/blog-dedicated-client-auth-plan.md`
> - `docs/auth-migration-backlog.md`
> - `docs/auth-space-access-control-implementation-plan.md`
> - `/home/quanghuy1242/pjs/payloadcms/docs/comment-improvements.md`

## 1. Goal

Add the product-facing blog and PayloadCMS integration layer that sits on top of the generic Auther public onboarding engine.

The previous signup epic makes Auther capable of:

- validating a signed signup intent
- creating or resolving an Auther user
- requiring email verification
- applying a configured authorization-space grant
- emitting grant webhooks
- letting Payload mirror grant events by authorization space

That is necessary, but it does not make the blog product flow visible to users.

This follow-on epic answers:

- Where does a reader click "Sign up" in `next-blog`?
- What happens when a user reaches sign-in but really needs a new account?
- Which server route in `next-blog` mints the Auther signup intent?
- Where does Auther send the user after verification?
- How does the user get a blog session after signup?
- What exactly can a public commenter do in Payload?
- What can a Payload admin or editor do that a commenter cannot?
- Which future next-blog/Payload items should remain backlog instead of blocking the first release?

The short version:

- `next-blog` owns public signup entrypoints.
- `next-blog` must mint signup intents only from server-side code.
- The browser must never receive the blog OAuth client secret or an authorization-space API key.
- Auther owns account creation and first-grant application.
- Payload owns content/admin access enforcement.
- A public `commenter` must not become a PayloadCMS staff user.
- A Payload `admin` or `editor` is a staff role and must be separate from public onboarding.

## 2. Product Flow Summary

Target reader flow:

```text
1. Reader clicks "Sign up" in the blog header, comment composer, gated content CTA, or sign-in fallback.
2. Blog server validates returnTo and creates a short-lived signup intent through Auther.
3. Blog redirects the browser to Auther /sign-up?intent=<token>.
4. Auther validates policy and shows the generic signup form.
5. Reader creates an account.
6. Reader verifies email.
7. Auther applies the configured Onboarding Flow grant.
8. Auther sends the reader back to the blog login route.
9. Blog OAuth login completes and stores the Better Auth token cookies.
10. Blog reloads the original page.
11. Payload links or creates the local Payload user when the token is first used.
12. Payload drains deferred grants and reads grant-mirror for content/comment access.
```

Default first-release continuation:

```text
Auther post-verification returnUrl =
  https://blog.example.com/auth/login?returnTo=<original_blog_path>

Reason:
  the signup flow creates the Auther account, but the blog still needs its own
  OAuth callback to place blog/Payload cookies on the blog domain.
```

Do not send the user directly back to a private book or comment target unless the blog already has a session token. If Auther redirects to a content page without the blog OAuth callback, the user may be signed up but still appear anonymous to `next-blog`.

## 3. Current-State Findings

### 3.1 `next-blog`

Existing relevant files:

- `pages/auth/login.tsx`
- `pages/auth/callback.tsx`
- `pages/auth/logout.tsx`
- `common/utils/blog-auth.ts`
- `common/utils/auth-cookies.ts`
- `common/utils/auth.ts`
- `components/core/header.tsx`
- `components/shared/comments/CommentsSection.tsx`
- `pages/api/comments/index.ts`
- `pages/api/comments/[commentId].ts`

Current behavior:

- `/auth/login` is not a visible page. It immediately creates PKCE state and redirects to Auther OAuth authorize.
- `/auth/callback` exchanges the OAuth code and sets `betterAuthToken` and `payload-token` cookies.
- The header shows `Sign in` when unauthenticated and `Logout` when authenticated.
- There is no `Sign up` link in the header.
- There is no `/auth/signup` route.
- There is no blog route that calls Auther `POST /api/auth/signup-intents`.
- Comment UI hides the composer when `viewerCanComment` is false, but it does not currently present a signup CTA.
- Blog API routes already forward Better Auth tokens to Payload through `Authorization: Bearer <token>`.

### 3.2 `payloadcms`

Existing relevant files:

- `src/payload.config.ts`
- `src/collections/Users.ts`
- `src/collections/Books.ts`
- `src/collections/Chapters.ts`
- `src/collections/Posts.ts`
- `src/collections/Categories.ts`
- `src/collections/Media.ts`
- `src/collections/Comments.ts`
- `src/collections/Bookmarks.ts`
- `src/collections/ReadingProgress.ts`
- `src/utils/access.ts`
- `src/utils/comments.ts`
- `src/utils/grantMirror.ts`
- `src/app/api/webhooks/auther/route.ts`
- `src/app/api/internal/reconcile/route.ts`
- `src/lib/betterAuth/users.ts`
- `src/lib/betterAuth/strategy.ts`
- `src/lib/betterAuth/tokens.ts`

Current behavior:

- Payload trusts Better Auth JWTs through JWKS verification.
- Payload links local users by `betterAuthUserId`.
- Payload creates or links the local user on first authenticated Payload request.
- Payload drains deferred grants after local user creation or first link.
- Payload mirrors grants for supported entity types into `grant-mirror`.
- Payload supports authorization-space routing when `AUTHER_USE_SPACE_ROUTING=true` and `AUTHER_AUTHORIZATION_SPACE_ID=<space-id>`.
- `Users.role` currently has `admin` and `user`.
- `admin` is the only clear staff role.
- `user` currently means "non-admin authenticated Payload user", but it is too broad for public signup because several content collection create paths use `authenticatedAccess`.
- `Books`, `Posts`, `Categories`, and `Media` currently allow create for any authenticated non-admin user through `authenticatedAccess`.
- `Comments` collection remains admin-only at collection level, while public comment behavior is handled by custom GraphQL helpers.
- `Bookmarks` and `ReadingProgress` are authenticated self-owned user features and should remain available to public readers.

### 3.3 Auther Signup Intent Endpoint

After the prerequisite epic, Auther exposes:

```text
POST /api/auth/signup-intents
```

Required request fields:

```json
{
  "flow": "blog-commenter",
  "authorizationSpaceId": "<payload-content-space-id>",
  "trigger": {
    "kind": "oauth_client",
    "id": "<blog-trigger-client-id>"
  },
  "returnUrl": "https://blog.example.com/auth/login?returnTo=/books/1-title",
  "expiresInSeconds": 300
}
```

Optional request field:

```json
{
  "requestedGrants": [
    {
      "entityTypeId": "<model-id>",
      "relation": "commenter",
      "entityId": "*"
    }
  ]
}
```

Recommended first release:

- Do not send `requestedGrants` from `next-blog`.
- Configure the exact grant plan in the Auther Onboarding Flow UI.
- Let Auther apply the configured default grants.

Reason:

- It avoids duplicating model IDs and relation names in `next-blog`.
- It keeps the product promise that the first flow is UI-managed, not blog-hardcoded.
- It reduces env drift. The blog only needs flow slug, target space ID, and trigger credentials.

Important current endpoint constraint:

- OAuth-client trigger authentication uses HTTP Basic with the trigger client's ID and secret.

That means `next-blog` needs a server-only trigger credential. If the existing blog OAuth client is intentionally public PKCE with no secret, create a separate server-only signup trigger client linked to the same authorization space, or extend Auther later to support a different server-to-server trigger credential.

## 4. Architecture Decisions

### 4.1 Blog Owns Signup Initiation

`next-blog` should not deep-link users directly to a reusable Auther signup URL.

Correct:

```text
Browser -> /auth/signup?returnTo=/books/1-title
Blog server -> Auther /api/auth/signup-intents
Blog server <- { signupUrl }
Browser <- 303 redirect to signupUrl
```

Rejected:

```text
Browser -> https://auther.example.com/sign-up?flow=blog-commenter
```

Why rejected:

- A public browser cannot prove the signup source.
- Flow slug alone is not an authorization proof.
- Return URL and grant subset policy must be checked server-side.
- Auther direct signup may be disabled.

### 4.2 Signup Should Return Through Blog Login

Use the blog login route as the post-verification continuation:

```text
returnUrl = /auth/login?returnTo=<original destination>
```

This gives the blog a normal OAuth callback and cookie-setting path.

Rejected first-release shortcut:

```text
returnUrl = <original content page>
```

Why rejected:

- User may arrive authenticated in Auther but not have `betterAuthToken` or `payload-token` cookies on the blog domain.
- SSR pages in `next-blog` read those cookies to call Payload as the user.
- Payload deferred grant drain is triggered by token-authenticated Payload requests, so the blog needs the token.

### 4.3 Public Commenter Is Not Payload Staff

A public signup grant should not imply PayloadCMS admin access.

Target meaning:

```text
commenter:
  can authenticate on the public blog
  can create comments where comment policy allows
  can manage own reading progress and bookmarks
  can read public content
  can read private content only if separate reader/viewer grants allow it
  cannot access Payload admin shell
  cannot create books, chapters, posts, categories, media, or users
```

Staff roles are separate:

```text
admin:
  can access Payload admin
  can manage users, roles, content, imports, grants, and configuration

editor:
  can access Payload admin
  can manage content according to editor policy
  cannot manage users, secrets, webhook config, or role elevation

author:
  optional future role
  can access Payload admin
  can manage own posts/books/media only

commenter / reader:
  no Payload admin shell
  public-site features only
```

### 4.4 Comment Authorization Must Match The Grant Model

If the Onboarding Flow grants a `commenter` relation, Payload must have a real rule that uses it.

Do not leave comment creation as "any authenticated user can comment" if the product meaning is "signed-up commenters can comment."

First-release acceptable choices:

#### Option A: Authenticated User Means Commenter

Use when every public signup creates a normal blog user and every authenticated blog user may comment.

Rules:

- `viewerCanComment = authenticated Payload user`
- Onboarding `commenter` grant is mostly a future-proof record and audit trail
- Payload admin/staff is still separated by local role

Tradeoff:

- Simpler.
- The `commenter` relation does not actually gate comment creation.
- A user who signs in through another allowed path may be able to comment even without the mirrored `commenter` grant.

#### Option B: Mirrored Grant Gates Commenting

Use when `commenter` must be meaningful authorization.

Rules:

- `viewerCanComment = staff OR has active commenter grant for target`
- comment create/update/reply checks the same helper server-side
- anonymous users cannot comment
- authenticated users without the grant see an access CTA

Recommended for this product flow.

Target grant shape for book/chapter comments:

```text
entityType = book
entityId = "*" or <book id>
relation = commenter
subject = user:<auther user id>
authorizationSpaceId = <payload content authorization space id>
```

Target grant shape for post comments, if post comments remain public:

```text
entityType = post
entityId = "*" or <post id>
relation = commenter
```

But Payload currently mirrors only:

```text
book
chapter
comment
```

Therefore the first release should either:

- only gate book/chapter comments by `book` commenter grants, and keep post comments disabled or authenticated-only, or
- add `post` to the mirrored entity types and Auther authorization model before using grant-gated post comments.

## 5. Target High-Level Architecture

```text
next-blog
  /auth/signup
    server-side signup entrypoint
    mints short-lived Auther signup intent
    redirects to Auther /sign-up

  /auth/login
    existing OAuth login entrypoint
    used after signup verification to place blog cookies

  comment and gated-content CTAs
    route unauthenticated users to /auth/signup or /auth/login
    route authenticated-but-not-authorized users to request/access messaging

Auther
  global signup policy
  authorization-space onboarding policy
  Onboarding Flow
  signed signup intent
  post-email-verification grant application
  grant.created webhook scoped by authorization space

PayloadCMS
  Better Auth token verification
  local user link/create
  role and admin-shell access separation
  deferred grant drain
  grant-mirror read model
  content/comment access helpers
```

## 6. `next-blog` Implementation Plan

### 6.1 Environment Contract

Existing env already used by auth:

```text
AUTH_BASE_URL
BLOG_CLIENT_ID
BLOG_REDIRECT_URI
NEXT_PUBLIC_SITE_URL
AUTH_SHARED_COOKIE_DOMAIN
```

Add server-only signup env:

```text
BLOG_SIGNUP_FLOW_SLUG=blog-commenter
BLOG_SIGNUP_AUTHORIZATION_SPACE_ID=<payload-content-space-id>
BLOG_SIGNUP_TRIGGER_KIND=oauth_client
BLOG_SIGNUP_TRIGGER_CLIENT_ID=<blog-or-signup-trigger-client-id>
BLOG_SIGNUP_TRIGGER_CLIENT_SECRET=<server-only-secret>
BLOG_SIGNUP_INTENT_TTL_SECONDS=300
```

Optional only if `next-blog` will request a subset of a broader flow:

```text
BLOG_SIGNUP_REQUESTED_ENTITY_TYPE_ID=<model-id>
BLOG_SIGNUP_REQUESTED_RELATION=commenter
BLOG_SIGNUP_REQUESTED_ENTITY_ID=*
```

Recommended first release:

- omit `BLOG_SIGNUP_REQUESTED_*`
- keep grant selection in Auther Onboarding Flow UI

Security rules:

- `BLOG_SIGNUP_TRIGGER_CLIENT_SECRET` must never be prefixed with `NEXT_PUBLIC_`.
- It must only be read in server-side code.
- It must never be logged.
- It must not be available to browser bundles.

### 6.2 New Server Route: `/auth/signup`

Add:

```text
pages/auth/signup.tsx
```

Preferred shape:

- Next.js page with `getServerSideProps`.
- Renders nothing.
- Always performs a server-side redirect.

Inputs:

```text
returnTo=<relative blog path>
source=header|comment|gated-content|login-fallback  optional analytics/source hint
```

Validation:

- reuse `normalizeReturnTo()` from `common/utils/blog-auth.ts`
- only accept relative paths
- reject `//evil.example`
- reject absolute URLs
- default to `/`

Server behavior:

```text
1. normalize returnTo
2. build continuation:
   /auth/login?returnTo=<returnTo>
3. convert continuation to an absolute blog URL
4. POST to Auther /api/auth/signup-intents
5. use Basic auth:
   base64(triggerClientId + ":" + triggerClientSecret)
6. send flow, authorizationSpaceId, trigger, returnUrl, expiresInSeconds
7. if Auther returns signupUrl, redirect there
8. if Auther denies, redirect to a local error page or login fallback
```

Auther request:

```http
POST https://auther.example.com/api/auth/signup-intents
Authorization: Basic <base64(clientId:clientSecret)>
Content-Type: application/json
```

Body:

```json
{
  "flow": "blog-commenter",
  "authorizationSpaceId": "space_payload",
  "trigger": {
    "kind": "oauth_client",
    "id": "blog-signup-trigger"
  },
  "returnUrl": "https://blog.example.com/auth/login?returnTo=%2Fbooks%2F1-example",
  "expiresInSeconds": 300
}
```

Success response:

```json
{
  "token": "...",
  "signupUrl": "https://auther.example.com/sign-up?intent=...",
  "nonce": "...",
  "expiresAt": "2026-05-07T13:00:00.000Z"
}
```

Failure handling:

- `401`: trigger credentials are wrong or client is inactive.
- `403`: global policy, space policy, flow policy, trigger allowlist, grant target, return URL, or domain policy denied the request.
- `400`: env or request body is malformed.

User-facing fallback:

- Redirect to `/auth/login?returnTo=<returnTo>&signup=unavailable`, or
- Add `/auth/signup-unavailable` with a neutral explanation.

Do not expose Auther's raw error text directly to the public page if it contains internal IDs.

### 6.3 Header UI

Edit:

```text
components/core/header.tsx
```

Unauthenticated target header:

```text
About me | Sign in | Sign up
```

Links:

```text
Sign in:
  /auth/login?returnTo=<current path>

Sign up:
  /auth/signup?returnTo=<current path>&source=header
```

Rules:

- Use hard navigation for both because both routes rely on server-side redirect and cookies.
- Preserve the current path through `returnTo`.
- Keep the UI compact; this blog header is not a marketing landing page.

### 6.4 Comment CTA UI

Edit:

```text
components/shared/comments/CommentsSection.tsx
components/shared/comments/CommentComposer.tsx
hooks/useComments.ts
pages/api/auth/session.ts
```

Current state:

- If `viewerCanComment` is false, the composer is hidden.
- Anonymous users see no obvious path to sign up from the comment area.

Target states:

```text
anonymous:
  show "Sign in" and "Create account" actions

authenticated and can comment:
  show composer

authenticated but cannot comment:
  show "Your account does not have comment access yet."
  if future approval flow exists, show "Request access"
  otherwise show neutral support/contact copy
```

Implementation notes:

- `pages/api/auth/session.ts` currently returns only `isAuthenticated`.
- Keep it minimal if enough.
- If the UI needs to distinguish "authenticated but no comment grant" from anonymous, it can use:
  - `isAuthenticated` from `/api/auth/session`
  - `viewerCanComment` from Payload comments query
- Do not trust client-side state for authorization. Payload must enforce create/update/reply permission server-side.

Comment CTA links:

```text
Sign in:
  /auth/login?returnTo=<current path>

Create account:
  /auth/signup?returnTo=<current path>&source=comment
```

### 6.5 Gated Content CTA

Relevant files:

```text
pages/books/[slug].tsx
pages/books/[slug]/chapters/[chapterSlug].tsx
components/pages/books/chapter-password-gate.tsx
components/pages/books/chapter-lock-badge.tsx
```

Current private content behavior:

- Payload returns only content the token can read.
- The blog returns `notFound` when a private book/chapter is not readable.
- Password-protected chapters have a visible password gate for anonymous/non-token paths.

First-release requirement:

- Do not confuse commenter signup with private content purchase/access.
- A public commenter grant should not imply private book read access unless the Onboarding Flow explicitly grants a reader/viewer relation.

Acceptable first-release UI:

- Public comment/signup CTA only on public content and comment areas.
- Private-book 404 remains unchanged.

Future gated-content backlog:

- Add a "Sign in or request access" page for private books.
- Add a request/approval flow for private-book reader grants.
- Add checkout/subscription if private content becomes paid.

### 6.6 Sign-In Page Fallback

Current `/auth/login` renders no UI and redirects immediately.

This means there is no local sign-in page where a user can click "Sign up."

First-release options:

#### Option A: Keep `/auth/login` Redirect-Only

Add signup CTAs elsewhere:

- header
- comments
- future gated-content page

This is lowest risk and matches current architecture.

#### Option B: Add `/auth/entry`

Add a small local page:

```text
/auth/entry?returnTo=<path>
```

It shows:

- Sign in
- Create account

Then:

```text
Sign in -> /auth/login?returnTo=<path>
Create account -> /auth/signup?returnTo=<path>&source=auth-entry
```

Use this if the product wants a visible auth chooser.

#### Option C: Auther Sign-In Page Has A "Create Account" Link

This is not enough by itself when direct Auther signup is disabled.

To make it safe:

- Auther OAuth authorize UI must know the request came from the blog.
- Auther must mint or request a valid signup intent for that client/flow.
- Or Auther must redirect back to the blog `/auth/signup` entrypoint.

Backlog item:

- Add "Create account for this app" support to Auther OAuth sign-in UI when the OAuth client has exactly one enabled public Onboarding Flow.

Do not block the first blog signup release on this.

## 7. PayloadCMS Access Model Plan

### 7.1 Problem

Payload currently uses `role = admin | user`.

That is too coarse:

```text
admin:
  staff user

user:
  currently means any authenticated user
  also gets create access to some content collections
```

After public signup, many users will be normal readers/commenters. They must not accidentally become Payload content creators or see useful Payload admin screens.

### 7.2 Target Role Model

Use one of these approaches.

#### Recommended: Expand Roles

Update:

```text
src/utils/access.ts
src/collections/Users.ts
src/lib/betterAuth/users.ts
```

Target role values:

```text
admin
editor
author
commenter
```

Role meanings:

```text
admin:
  full Payload staff
  can manage users and roles
  can manage all content and admin-only collections
  can trigger grant reconciliation

editor:
  staff
  can access Payload admin
  can create/update/publish content according to editor policy
  can moderate comments
  cannot manage users, roles, secrets, webhook config, or API keys

author:
  staff or semi-staff
  can access Payload admin
  can create/update own posts/books/media
  cannot manage other users or global settings

commenter:
  public user
  cannot access Payload admin
  can comment only when comment access policy allows
  can use own bookmarks and reading progress
  can update own profile fields only through safe public/profile surfaces
```

Migration-compatible alternative:

- Keep database value `user`, but relabel it as "Commenter" in UI.
- Add `editor` and `author`.
- Treat `user` as non-staff everywhere.

This is lower migration risk but less semantically clean.

### 7.3 Staff Helper Functions

Add or update helpers in:

```text
src/utils/access.ts
```

Target helpers:

```ts
isAdminUser(user)
isEditorUser(user)
isAuthorUser(user)
isStaffUser(user)
canAccessPayloadAdmin(user)
contentCreateAccess(args)
contentUpdateAccess(ownerField)
contentDeleteAccess(ownerField)
commentModerationAccess(args)
publicUserAccess(args)
```

Expected logic:

```text
isAdminUser:
  role === "admin"

isEditorUser:
  role === "editor"

isAuthorUser:
  role === "author"

isStaffUser:
  admin OR editor OR author

canAccessPayloadAdmin:
  admin OR editor OR author

publicUserAccess:
  authenticated user, including commenter
```

### 7.4 Payload Admin Shell Access

Goal:

- `commenter` cannot use PayloadCMS admin.
- `admin`, `editor`, and `author` can access the admin shell.

Implementation options:

#### Option A: Middleware Gate

Add a Next middleware or route-level guard for `/admin`.

Behavior:

```text
1. verify Better Auth token through Payload auth
2. if no user, keep current BetterAuthLoginRedirect behavior
3. if user.role is commenter/user, redirect to public blog or show 403
4. if staff, allow admin request
```

#### Option B: Payload Admin Custom Component Gate

Add a before-dashboard component that checks current user and redirects non-staff.

Tradeoff:

- Easier to implement in the Payload admin surface.
- Less complete than middleware because the shell may partially load.

Recommended:

- Use middleware or a server-side admin route guard where possible.
- Keep collection access rules as the real safety net.

### 7.5 Collection Access Matrix

Target first-release matrix:

| Collection | anonymous | commenter | author | editor | admin |
| --- | --- | --- | --- | --- | --- |
| `users` | none | self read/update safe fields | self | read staff-limited if needed | full |
| `books` read | public only | public + mirrored grants + own if any | own + public + mirrored | all or editor policy | all |
| `books` create | none | none | yes | yes | yes |
| `books` update/delete | none | none | own | all or assigned | all |
| `chapters` read | public only | public + mirrored grants | own + public + mirrored | all | all |
| `chapters` create/update/delete | none | none | own book only | all or assigned | all |
| `posts` read | published only if public API needs it | published | own drafts + published | all | all |
| `posts` create/update/delete | none | none | own | all or assigned | all |
| `categories` create/update/delete | none | none | none or own | yes | yes |
| `media` create/update/delete | none | none | own uploads | all or assigned | all |
| `comments` collection | none | none | moderation if assigned, optional | moderate | moderate/full |
| public comment GraphQL | read public | create/edit/delete own when allowed | create/edit own | create/edit/moderate | create/edit/moderate |
| `bookmarks` | none | own | own | own | own/all only if admin tool needs it |
| `reading-progress` | none | own | own | own | own/all only if admin tool needs it |
| `grant-mirror` | none | none | none | view if needed | full |
| `deferred-grants` | none | none | none | view if needed | full |

### 7.6 Content Collection Changes

Files:

```text
src/collections/Books.ts
src/collections/Chapters.ts
src/collections/Posts.ts
src/collections/Categories.ts
src/collections/Media.ts
src/utils/access.ts
```

Required change:

- Replace broad `authenticatedAccess` for content creation with staff-aware helpers.

Examples:

```text
Books.create:
  from authenticatedAccess
  to contentCreateAccess

Posts.create:
  from authenticatedAccess
  to contentCreateAccess

Categories.create:
  from authenticatedAccess
  to editorOrAdminAccess

Media.create:
  from authenticatedAccess
  to staffMediaCreateAccess
```

Rules:

- A commenter must not create content by being merely authenticated.
- Existing owner access rules should still apply for author/editor/admin as configured.
- Admin bypass remains explicit.

### 7.7 Public Feature Collections

Files:

```text
src/collections/Bookmarks.ts
src/collections/ReadingProgress.ts
src/utils/readingFeatures.ts
```

Keep:

- authenticated self-owned create/read/update/delete

Reason:

- A commenter/reader should be able to use public reader features.
- These collections are hidden from admin and owner-scoped.

### 7.8 Comment Access Policy

Files:

```text
src/utils/comments.ts
src/graphql/queries/Comments/resolver.ts
src/graphql/mutations/CreateComment/resolver.ts
src/graphql/mutations/UpdateComment/resolver.ts
src/graphql/mutations/DeleteComment/resolver.ts
```

Target if using Option B from section 4.4:

```text
viewerCanComment:
  staff OR hasCommenterGrantForTarget

createComment:
  authenticated
  target readable
  hasCommenterGrantForTarget OR staff
  rate limit
  create pending comment

reply:
  same as create
  parent comment must be approved

update/delete own comment:
  author ownership
  edit window
  target still readable
  no extra commenter grant required for own existing comment, or require current grant if policy wants revocation to stop all future edits
```

Recommended revocation behavior:

- Revoking commenter stops new comments and replies.
- Existing own pending/approved comments remain visible under normal public comment rules.
- Edit/delete of existing own comments can stay author-owned during the edit window.

Grant helper:

```text
hasCommenterGrantForTarget(payload, user, target):
  if target is chapter:
    load chapter.book
    check active grant-mirror row:
      payloadUserId = user.id
      entityType = "book"
      relation = "commenter"
      syncStatus = "active"
      entityId in ["*", <book id>]

  if target is post:
    either:
      use authenticated-only rule for posts, or
      add "post" as a mirrored entity type and check post grants
```

Do not check only local Payload role for commenter if Auther is the source of onboarding grants.

### 7.9 Better Auth Role Mapping

File:

```text
src/lib/betterAuth/users.ts
```

Current behavior:

- token roles choose `admin` if present
- token roles choose `user` if present
- otherwise new users become `user`

Target behavior:

```text
if token roles include admin:
  Payload role = admin
else if token roles include editor:
  Payload role = editor
else if token roles include author:
  Payload role = author
else:
  Payload role = commenter/user-public
```

Rules:

- A public signup must not get `editor` or `admin` from the onboarding `commenter` grant.
- Payload staff promotion should happen through an explicit Auther staff role or explicit Payload admin action.
- Public onboarding grants live in `grant-mirror`; staff role lives in Payload user role or Auther role claims.

Backlog:

- Decide whether Payload staff roles are controlled only by Auther roles, only by Payload local admin edits, or by a synced hybrid model.

## 8. Auther Admin Setup After Prerequisite Epic

This is configuration, not new generic signup engine code.

### 8.1 Authorization Space

In Auther:

```text
/admin/authorization-spaces
```

Target:

- `payload-content` authorization space exists.
- Space is enabled.
- Space onboarding is enabled.
- Blog trigger client is included in onboarding allowed triggers.
- Payload resource server is configured if resource-server-triggered flows are used later.

### 8.2 Linked Client

In Auther:

```text
/admin/clients/<blog-client-id>/spaces
```

Target:

- Blog login client is linked to `payload-content`.
- Access mode is at least `can_trigger_contexts` if that client mints signup intents.

If the blog OAuth client is public and has no secret:

- Create a separate server-only signup trigger client.
- Link that trigger client to the same authorization space with `can_trigger_contexts`.
- Use that trigger client only in `next-blog` server-side `/auth/signup`.

### 8.3 Onboarding Flow

In Auther:

```text
/admin/access#onboarding-flows
```

Target flow:

```text
slug: blog-commenter
signup mode: public signed intent
enabled: true
trigger: blog signup trigger client
target: payload-content authorization space
grant model: book, comment, or configured first-release model
relation: commenter
entity scope: *
allowed return URLs:
  https://blog.example.com/auth/login
  https://blog.example.com/auth/login/
allowed domains:
  optional
theme:
  blog
```

Return URL note:

- If Auther return URL validation treats path prefixes as allowed, allow `/auth/login` and rely on the existing boundary check that prevents `/auth/login-extra`.
- Query strings should be allowed for `returnTo`.

### 8.4 Payload Webhook

In Auther:

```text
/admin/webhooks
```

Target:

- Endpoint points to `https://payload.example.com/api/webhooks/auther`.
- Endpoint is active.
- Endpoint secret matches `AUTHER_WEBHOOK_SECRET` in Payload.
- Endpoint filter is the payload content authorization space.
- Subscribed events include:
  - `grant.created`
  - `grant.revoked`
  - `group.member.added`
  - `group.member.removed`

### 8.5 Payload Environment

In Payload:

```text
AUTHER_USE_SPACE_ROUTING=true
AUTHER_AUTHORIZATION_SPACE_ID=<payload-content-space-id>
AUTHER_AUTHORIZATION_SPACE_SLUG=payload-content
AUTHER_WEBHOOK_SECRET=<matching secret>
AUTHER_API_KEY=<space-capable service key>
AUTH_BASE_URL=<auther origin>
```

Keep legacy client env only while compatibility requires it:

```text
AUTHER_CLIENT_ID=<payload client id>
PAYLOAD_CLIENT_ID=<payload client id>
```

## 9. User Experience Requirements

### 9.1 Header

Unauthenticated:

```text
About me | Sign in | Sign up
```

Authenticated:

```text
About me | Logout
```

Optional future:

```text
About me | Shelf | Profile | Logout
```

### 9.2 Comment Section

Anonymous:

```text
Comments
Sign in to comment
Create account
```

Authenticated with comment access:

```text
Comments
composer
thread
```

Authenticated without comment access:

```text
Comments
Your account does not have comment access yet.
```

Future:

```text
Request access
```

### 9.3 Signup Error States

Blog `/auth/signup` should handle:

- signup temporarily unavailable
- invalid return path
- Auther policy denied
- trigger credential misconfigured
- Auther unavailable

Public copy should stay neutral:

```text
Sign up is not available from this entry point right now.
```

Do not expose:

- client IDs
- authorization space IDs
- model IDs
- relation names
- raw Auther policy errors

### 9.4 After Email Verification

Expected first-release user experience:

```text
1. user verifies email in Auther
2. Auther redirects to /auth/login?returnTo=<original path>
3. blog OAuth login completes
4. user lands on original path
5. comment composer appears if grant and Payload mirror are ready
```

If webhook is delayed:

- Payload may not have `grant-mirror` yet.
- The first authenticated Payload request should drain deferred grants if the grant arrived before local user creation.
- If the tuple already existed but no webhook fired, reconciliation should repair it.

User-facing fallback:

```text
Your account is ready. If access does not appear immediately, refresh in a moment.
```

## 10. Edge Cases And Failure Modes

### 10.1 Signup Intent Minted But Policy Changes Before Verification

Auther must already fail closed from the prerequisite epic.

Blog expectation:

- User may finish account creation but not receive the commenter grant.
- Blog should show authenticated-without-comment-access state.

### 10.2 User Already Has Auther Account

Target:

- Auther resolves existing user.
- If email is verified, grant is applied idempotently.
- If email is unverified, email verification is required before grant.
- Blog continuation still goes through `/auth/login`.

### 10.3 User Already Has Payload User But No Mirror Row

Target:

- `grant.created` creates mirror row if event is emitted.
- Reconcile endpoint can repair missed rows.
- Existing tuple with missing mirror is not considered complete until reconcile/bootstrap can prove the row exists.

### 10.4 User Has Commenter But Opens Payload Admin

Target:

- No admin shell access.
- No content collection create/update/delete access.
- Public GraphQL comments/bookmarks/progress still work.

### 10.5 User Has Admin Or Editor

Target:

- Can sign into Payload admin through Better Auth.
- Local Payload role maps to staff role.
- Staff role does not depend on public `commenter` grant.
- Staff user can still use public blog commenting as an authenticated user or through staff override.

### 10.6 Post Comments

Current Payload mirror supports `book`, `chapter`, and `comment`.

If post comments should require `commenter` grants:

- Add `post` as an authorization model in Auther.
- Add `post` to Payload mirrored entity types.
- Update grant mirror and reconcile tests.
- Add Onboarding Flow grant for `post:* commenter`.

If post comments can stay "any authenticated user":

- Document that post comments are outside the first grant-gated commenter model.

Do not leave this ambiguous.

## 11. Implementation Backlog

### 11.1 `next-blog`: Signup Intent Client

- Add server-only env readers for signup config.
- Add helper to call Auther `POST /api/auth/signup-intents`.
- Use Basic auth only on the server.
- Normalize `returnTo`.
- Build absolute continuation URL to `/auth/login`.
- Parse Auther success and failure responses.
- Unit test env validation and return path normalization.

Target files:

```text
common/utils/blog-signup.ts
pages/auth/signup.tsx
tests/pages/auth-signup.test.ts
tests/utils/blog-signup.test.ts
```

### 11.2 `next-blog`: Signup UI Entrypoints

- Add `Sign up` to unauthenticated header.
- Add comment-section sign-in/sign-up CTA.
- Preserve `returnTo`.
- Use hard navigation for auth routes.
- Add tests for header links and comment CTA states.

Target files:

```text
components/core/header.tsx
components/shared/comments/CommentsSection.tsx
tests/components/header.test.tsx
tests/components/comment-item.test.tsx
```

### 11.3 `next-blog`: Auth Entry Fallback

Choose one:

- keep `/auth/login` redirect-only and rely on header/comment signup CTAs
- add `/auth/entry`

If adding `/auth/entry`:

- render Sign in and Create account actions
- route Create account to `/auth/signup`
- route Sign in to `/auth/login`
- do not make `/auth/login` ambiguous

Target files:

```text
pages/auth/entry.tsx
tests/pages/auth-routes.test.ts
```

### 11.4 `payloadcms`: Role Model Hardening

- Decide whether to add `editor` and `author`.
- Decide whether to rename `user` to `commenter` or keep `user` as public role.
- Add role helper functions.
- Update `Users` role options and field labels.
- Update Better Auth role mapping.
- Add migration if enum/storage constraints require it.

Target files:

```text
src/utils/access.ts
src/collections/Users.ts
src/lib/betterAuth/users.ts
tests/int/better-auth-users.int.spec.ts
```

### 11.5 `payloadcms`: Content Access Hardening

- Replace broad `authenticatedAccess` on content create routes.
- Ensure commenter cannot create:
  - books
  - chapters
  - posts
  - categories
  - media
- Ensure editor/admin can create according to policy.
- Ensure author can create only if the author role is intentionally enabled.
- Keep bookmarks and reading progress self-owned.

Target files:

```text
src/collections/Books.ts
src/collections/Chapters.ts
src/collections/Posts.ts
src/collections/Categories.ts
src/collections/Media.ts
src/collections/Bookmarks.ts
src/collections/ReadingProgress.ts
src/utils/access.ts
tests/int/access-control.int.spec.ts
```

### 11.6 `payloadcms`: Payload Admin Shell Gate

- Add staff-only admin shell gate.
- Redirect or reject non-staff users.
- Verify commenter cannot browse `/admin`.
- Verify staff can browse `/admin`.

Target files:

```text
src/middleware.ts
src/payload.config.ts
src/components/admin/BetterAuthLoginRedirect.tsx
tests/int/admin-access.int.spec.ts
```

Exact file choice depends on what Payload/Next route layer can cleanly enforce before the admin shell loads.

### 11.7 `payloadcms`: Commenter Grant Enforcement

If choosing grant-gated comments:

- Add helper to check active `commenter` grant for target.
- Use grant-mirror for local fast path.
- Support wildcard and specific book IDs.
- Decide post-comment behavior.
- Update `viewerCanComment`.
- Update create/reply mutation guard.
- Keep edit/delete ownership behavior clear.

Target files:

```text
src/utils/comments.ts
src/graphql/queries/Comments/resolver.ts
src/graphql/mutations/CreateComment/resolver.ts
src/graphql/mutations/UpdateComment/resolver.ts
src/graphql/mutations/DeleteComment/resolver.ts
tests/int/comments.int.spec.ts
```

### 11.8 `payloadcms`: Mirror Support For Any New Comment Targets

If post comments are grant-gated:

- Add `post` to mirrorable entity types.
- Update parser tests.
- Update webhook tests.
- Update reconcile entity list.

Target files:

```text
src/utils/grantMirror.ts
src/app/api/webhooks/auther/route.ts
src/app/api/internal/reconcile/route.ts
tests/int/grant-mirror.int.spec.ts
tests/int/auther-webhook-route.int.spec.ts
tests/int/reconcile-route.int.spec.ts
```

### 11.9 Deployment Configuration

- Configure Auther global signup policy.
- Configure target auth space onboarding.
- Configure Onboarding Flow.
- Configure blog trigger credentials.
- Configure Payload webhook endpoint and secret.
- Configure Payload space routing env.
- Configure next-blog signup env.
- Run database migrations/pushes in all repos as needed.

### 11.10 Manual Smoke

Smoke path:

```text
1. open public blog page while logged out
2. click Sign up
3. complete Auther signup
4. verify email
5. return to blog login
6. complete OAuth callback
7. land on original page
8. confirm local Payload user exists
9. confirm grant-mirror row exists
10. confirm comment composer appears
11. create comment
12. confirm comment is pending or approved according to moderation policy
13. open Payload admin as commenter
14. confirm admin shell is denied
15. open Payload admin as editor/admin
16. confirm staff access works
```

## 12. Future Backlog

### 12.1 Auther Sign-In "Create Account For This App"

Problem:

- A user may click "Sign in" first, reach Auther, and only then realize they need an account.
- Direct Auther signup may be disabled.

Future target:

- Auther OAuth authorize/sign-in UI can show "Create account" when the requesting OAuth client has an enabled public Onboarding Flow.
- Clicking it must mint or require a valid signup intent.
- It must preserve OAuth state and return URL.

This should not block first release because `next-blog` can provide explicit signup CTAs.

### 12.2 Access Request Instead Of Auto-Grant

Future use case:

- User signs up but should wait for approval before receiving reader/editor/private-book access.

Use:

- `permission_requests`
- authorization-space target
- model/relation/entity scope

Do not overload pending registration context applications.

### 12.3 Private Book Request Flow

Future:

- If a private book is not visible, show a request-access page instead of `404`.
- Let authenticated users request `reader` on that book.
- Let admins/editors approve.
- Payload mirror then unlocks the book.

### 12.4 Comment Moderation Dashboard In Blog

Future:

- Staff moderation from `next-blog`, not only Payload admin.
- Requires staff role checks and a safe API surface.

### 12.5 Public Profile Page

Future:

- Let public users edit display name/avatar/bio outside Payload admin.
- Keep role field hidden.
- Keep admin shell inaccessible.

### 12.6 Role Source Of Truth

Future decision:

- Auther roles as source of truth
- Payload local roles as source of truth
- Hybrid with Auther promotion and Payload local override

Requirement:

- Public onboarding grant must never silently promote to staff.

### 12.7 Post Comment Grant Model

Future:

- Add `post` model and mirror support if post comments should require grants.
- Decide whether post comments are open to all authenticated users or only commenters.

### 12.8 Signup Analytics And Abuse Controls

Future:

- signup source analytics
- rate limits on `/auth/signup`
- challenge/captcha before minting intent if abused
- signup conversion events
- email domain rollout rules

### 12.9 Account Linking And Duplicate Emails

Future:

- Better messaging when a user signs up with an email that already exists.
- Existing account path should guide to sign in and apply onboarding grant after verified ownership.

## 13. Definition Of Done

This epic is done only when the user-facing blog signup flow and Payload access model are safe enough to expose public signup.

### 13.1 Blog Signup Entrypoint

- `next-blog` has a server-side signup route that calls Auther `POST /api/auth/signup-intents`.
- The signup route uses server-only credentials.
- The signup route validates `returnTo` as a relative path.
- The signup route builds a continuation through `/auth/login`.
- The signup route redirects to Auther `signupUrl`.
- The browser never sees the trigger client secret or API key.
- Auther policy denials produce a safe user-facing fallback.

### 13.2 Blog UI

- Header shows a clear `Sign up` action when logged out.
- Comment area shows sign-in/sign-up CTAs for anonymous users.
- Authenticated users with comment access see the composer.
- Authenticated users without comment access see a clear no-access state.
- `returnTo` is preserved from header and comment CTA.
- `/auth/login` continues to work as the normal OAuth login route.

### 13.3 Payload Role Safety

- Public signup creates or links a Payload user as non-staff.
- Public commenter/reader cannot access Payload admin shell.
- Public commenter/reader cannot create books, chapters, posts, categories, or media.
- Admin can access Payload admin.
- Editor can access Payload admin if the editor role is included.
- Staff role mapping is explicit and tested.
- Public onboarding grants do not modify Payload staff role.

### 13.4 Payload Comment Authorization

- The product chooses either authenticated-commenting or grant-gated commenting.
- If grant-gated, Payload checks active mirrored `commenter` grants before returning `viewerCanComment=true`.
- If grant-gated, comment create/reply enforce the same server-side rule.
- Revoking commenter stops new comments.
- Existing own comment edit/delete behavior is documented and tested.
- Post-comment behavior is explicitly decided.

### 13.5 Payload Mirror And Deferred Grants

- Payload webhook accepts only events for the configured authorization space when space routing is enabled.
- Payload writes deferred grants if the local user does not exist yet.
- Payload drains deferred grants when the user first signs in through the blog.
- Reconcile can repair a missed mirror row.
- The first signed-up user produces the expected `grant-mirror` row or a documented no-grant state.

### 13.6 End-To-End Smoke

- Logged-out user clicks blog Sign up.
- Auther signup form opens.
- User verifies email.
- User returns through blog login.
- Blog auth cookies are set.
- Payload local user exists and has the expected non-staff role.
- Payload grant mirror is present if the flow grants commenter.
- Comment composer appears only when policy says it should.
- User can create a comment where allowed.
- Same user cannot access Payload admin.
- Admin/editor user can access Payload admin.

### 13.7 Automated Tests

`next-blog` tests cover:

- signup route success redirect
- signup route Auther denial fallback
- returnTo normalization
- header sign-up link
- comment anonymous CTA
- comment authenticated/no-access state

`payloadcms` tests cover:

- commenter cannot access admin shell
- commenter cannot create content collections
- staff can create content according to role
- Better Auth role mapping
- comment `viewerCanComment` rules
- comment create denied without grant if grant-gated
- comment create allowed with grant if grant-gated
- deferred grant drain on user link/create
- reconcile repair

Manual deploy checks cover:

- env configuration
- webhook secret match
- authorization-space routing
- Auther Onboarding Flow setup
- live signup through email verification

## 14. Final Model

The final product model should be:

```text
next-blog:
  public product surface
  owns Sign in and Sign up entrypoints
  never owns grant policy
  never exposes trigger secrets

Auther:
  identity provider
  signup policy engine
  authorization-space grant source of truth
  email verification gate

PayloadCMS:
  content API
  admin shell
  local user projection
  local grant projection
  final content/comment access enforcement
```

For the first blog flow:

```text
Reader clicks Sign up on blog.
Blog mints signed signup intent.
Auther creates verified user and grants commenter.
Payload mirrors commenter for the content authorization space.
Blog signs the user in through OAuth.
Payload treats the user as public non-staff.
User can comment where allowed.
User cannot use Payload admin.
Admin/editor promotion stays a separate explicit staff flow.
```

