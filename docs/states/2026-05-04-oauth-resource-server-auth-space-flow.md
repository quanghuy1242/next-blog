# Session Summary: OAuth Client, Resource Server, Authorization Space Flow

> Date: 2026-05-04
>
> Repos inspected:
>
> - `/home/quanghuy1242/pjs/next-blog`
> - `/home/quanghuy1242/pjs/auther`
>
> Related planning docs:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/auth-migration-backlog.md`
> - `docs/states/2026-05-03-auth-r2-complete-summary.md`

---

## 1. Purpose

This note clarifies the roles and flow between:

- OAuth client
- client secret
- resource server
- authorization space
- permissions / authorization models
- tuples / grants
- Better Auth JWT / JWKS validation

The key conclusion is that `client_id` plus `client_secret` is still an OAuth client. It is not a resource server.

---

## 2. Core Distinction

### OAuth Client

An OAuth client is the application that asks Auther for login and tokens.

Examples in this system:

- `next-blog`
- Payload admin web client
- Payload SPA client

The OAuth client answers:

```text
Who is requesting login or a token?
```

A confidential OAuth client may have a `client_secret`. That only means it can authenticate itself to the token endpoint. It does not change the OAuth role.

Current Auther examples:

- `PAYLOAD_CLIENT_ID` with `PAYLOAD_CLIENT_SECRET`
- `PAYLOAD_SPA_CLIENT_ID` as public PKCE client
- `BLOG_CLIENT_ID` as public PKCE client

Relevant implementation:

- `/home/quanghuy1242/pjs/auther/src/lib/auth.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/utils/oauth-authorization.ts`

### Resource Server

A resource server is the API/backend that accepts bearer tokens.

Examples in the target architecture:

- `payload-content-api`
- future `reader-api`
- future `auther-management-api`

The resource server answers:

```text
Which API is this token meant for?
```

It should validate token claims such as:

```text
iss = Auther issuer
aud = resource server audience, for example payload-content-api
exp = not expired
signature = valid against Auther JWKS
```

Resource server audience validation is separate from JWKS signature validation.

JWKS answers:

```text
Did Auther sign this token?
```

Resource server audience answers:

```text
Was this token intended for this API?
```

Relevant implementation:

- `/home/quanghuy1242/pjs/auther/src/db/app-schema.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/repositories/resource-server-repository.ts`

### Authorization Space

An authorization space is the namespace where authorization models and grants live.

Examples:

- `payload-content`
- future `billing`
- future `internal-admin`

The authorization space answers:

```text
Which permission/model/grant namespace applies?
```

For Payload content, the intended authorization space is:

```text
payload-content
```

This space owns models such as:

```text
book
chapter
comment
```

Current transitional entity type names still include the Payload client id:

```text
client_<PAYLOAD_CLIENT_ID>:book
client_<PAYLOAD_CLIENT_ID>:chapter
client_<PAYLOAD_CLIENT_ID>:comment
```

R2 adds `authorization_models.authorizationSpaceId` so those models can be owned by `payload-content` even while old client-shaped entity names remain.

Relevant implementation:

- `/home/quanghuy1242/pjs/auther/src/db/app-schema.ts`
- `/home/quanghuy1242/pjs/auther/src/db/rebac-schema.ts`
- `/home/quanghuy1242/pjs/auther/src/lib/repositories/authorization-space-repository.ts`

---

## 3. Current R2 Topology

R2 is complete and additive. It introduced the correct concepts without switching all runtime behavior yet.

The intended Payload/blog topology is created by:

```text
pnpm auth:r2:seed-payload-space
```

Relevant script:

- `/home/quanghuy1242/pjs/auther/scripts/seed-r2-payload-space.ts`

That script creates or updates:

```text
resource server:
  slug: payload-content-api
  audience: payload-content-api

authorization space:
  slug: payload-content
  resourceServerId: payload-content-api

client-space links:
  PAYLOAD_CLIENT_ID -> payload-content -> full
  BLOG_CLIENT_ID -> payload-content -> can_trigger_contexts

authorization models:
  client_<PAYLOAD_CLIENT_ID>:book -> payload-content
  client_<PAYLOAD_CLIENT_ID>:chapter -> payload-content
  client_<PAYLOAD_CLIENT_ID>:comment -> payload-content
```

Meaning:

```text
next-blog is an OAuth client.
Payload admin is an OAuth client.
Payload Content API is the resource server.
Payload Content is the authorization space.
Payload book/chapter/comment grants belong to the Payload Content space.
```

---

## 4. Current Login Flow

Current `next-blog` login flow:

1. User opens `/auth/login`.
2. `next-blog` creates PKCE verifier/state.
3. `next-blog` redirects to Auther:

```text
/api/auth/oauth2/authorize
  client_id=BLOG_CLIENT_ID
  redirect_uri=BLOG_REDIRECT_URI
  response_type=code
  scope=openid email profile
  code_challenge=...
```

4. Auther handles OAuth/OIDC through Better Auth.
5. Auther checks whether the user may use `BLOG_CLIENT_ID`.
6. Auther applies registration-context grants for this client if configured.
7. Auther returns an authorization code to `next-blog`.
8. `next-blog` exchanges the code at `/api/auth/oauth2/token`.
9. `next-blog` currently stores the returned `id_token` into Payload-compatible cookies:

```text
betterAuthToken
payload-token
```

Relevant next-blog implementation:

- `/home/quanghuy1242/pjs/next-blog/pages/auth/login.tsx`
- `/home/quanghuy1242/pjs/next-blog/pages/auth/callback.tsx`
- `/home/quanghuy1242/pjs/next-blog/common/utils/blog-auth.ts`
- `/home/quanghuy1242/pjs/next-blog/common/utils/auth-cookies.ts`

Important caveat:

This is transitional R1/R2 behavior. Long term, Payload resource access should use an access token targeted at the Payload resource server, not implicit ID token reuse.

---

## 5. Current Permission Flow

Auther permission checks are handled by:

- `/home/quanghuy1242/pjs/auther/src/lib/auth/permission-service.ts`
- `/home/quanghuy1242/pjs/auther/src/app/api/auth/check-permission/route.ts`

Example check:

```text
subjectType = user
subjectId = user_123
entityType = client_<PAYLOAD_CLIENT_ID>:book
entityId = book_456
permission = view
```

Current flow:

1. If the subject is an admin user, allow.
2. Check for client-wide `full_access` on:

```text
entityType = oauth_client
entityId = <clientId>
relation = full_access
```

3. Load the authorization model for the requested `entityType`.
4. Resolve the permission to a required relation.
5. Expand groups and implied relations.
6. Find matching tuples on the entity or wildcard entity.
7. Evaluate Lua/ABAC conditions if present.
8. Return allowed or denied.

Actual grants live in `access_tuples`.

Authorization models live in `authorization_models`.

The authorization space is now attached to models, but the normal permission lookup is still primarily by `entityType` in R2.

---

## 6. Registration Context Flow

Registration contexts are the clearest current place where authorization spaces actively affect behavior.

Relevant implementation:

- `/home/quanghuy1242/pjs/auther/src/lib/utils/registration-context-grants.ts`

R2 validation rule:

If a grant target model has `authorizationSpaceId`, the source client must be linked to that authorization space with context-trigger rights.

For example:

```text
BLOG_CLIENT_ID -> payload-content -> can_trigger_contexts
```

This allows blog-triggered registration contexts to grant access to models owned by `payload-content`.

Without that link, a blog client should not be able to mint grants into Payload content space.

Fallback compatibility:

If the target model has not been backfilled to an authorization space yet, R2 still supports old R1 validation through:

```text
oauth_client_metadata.grantProjectionClientIds
```

That metadata is transitional and should not be the final topology mechanism.

---

## 7. Current Resource Server Usage

In R2, resource servers exist as first-class metadata but are not yet the main runtime token boundary.

Current active usage:

- `resource_servers` table exists.
- `authorization_spaces.resourceServerId` links a space to a resource server.
- Admin CRUD and repositories exist.
- The R2 seed script creates `payload-content-api`.

Current missing runtime usage:

- OAuth token request does not yet clearly select a resource server audience.
- Payload does not yet primarily validate `aud = payload-content-api`.
- Payload projection routing still primarily uses client metadata.

This is expected because the R2 summary explicitly says:

```text
R2 remains additive.
Payload projection routing has not moved from client-based to space-based.
That switch belongs to R3.
Resource-server access-token semantics belong to R4.
```

---

## 8. Where Resource Server Comes In When Building An API

For a new API, the intended target flow is:

```text
1. Register an OAuth client for the app that requests login.
2. Register a resource server for the API that will receive tokens.
3. Register or link an authorization space for the resource domain.
4. Link allowed OAuth clients to the authorization space.
5. Issue access tokens with aud = resource server audience.
6. API validates token signature using Auther JWKS.
7. API validates aud equals its resource server audience.
8. API checks permissions using the authorization space's models/grants.
```

Example:

```text
OAuth client:
  next-blog-web

Resource server:
  payload-content-api

Authorization space:
  payload-content

Token audience expected by API:
  payload-content-api
```

API request:

```text
GET /api/books/123
Authorization: Bearer <access_token>
```

API validation:

```text
verify signature against Auther JWKS
verify iss = Auther
verify aud = payload-content-api
verify exp
check permission user can view book 123 in payload-content
```

Why JWKS is not enough:

JWKS only proves Auther signed the token. Without audience validation, an API may accidentally accept a token intended for another client or another API.

---

## 9. Target End State

After R3/R4, the clean flow should be:

```text
next-blog
  is OAuth client BLOG_CLIENT_ID
  requests user login and token

Auther
  authenticates user
  issues access_token for payload-content-api

Payload Content API
  is resource server payload-content-api
  validates token audience and signature

Payload Content
  is authorization space payload-content
  owns book/chapter/comment models and grants

PermissionService
  evaluates tuples/models/ABAC
```

The desired separation:

```text
OAuth client:
  Who is requesting login/token?

Resource server:
  Which API is this token meant for?

Authorization space:
  Which permission namespace applies?

Authorization model:
  What permissions and relations exist?

Tuple:
  Who has which relation on which object?
```

---

## 10. Remaining Migration Work

### R3

Move Payload projection routing from client-based to authorization-space-based.

Expected work:

- add `authorizationSpaceId` to Auther grant events
- optionally stamp tuples with `authorizationSpaceId`
- add space-based grant/list APIs
- make Payload webhook/reconcile prefer `authorizationSpaceId`
- keep `clientId` fallback during rollout

### R4

Move resource access to a proper resource-server audience contract.

Expected work:

- issue access tokens intended for `payload-content-api`
- make Payload validate `aud = payload-content-api`
- stop treating ID token reuse as the desired resource API contract
- update next-blog callback/token storage to persist the correct resource bearer token

---

## 11. Practical Conclusion

`client_id` plus `client_secret` is still an OAuth client.

Resource server is not a replacement for OAuth clients and not a replacement for JWKS.

The resource server becomes important at API boundaries:

```text
This API should only accept tokens whose audience is this API.
```

The authorization space becomes important at permission boundaries:

```text
These models and grants belong to this resource domain.
```

The current code has the R2 control-plane pieces in place. The runtime still needs R3 and R4 before the architecture is fully expressed in token validation and projection routing.
