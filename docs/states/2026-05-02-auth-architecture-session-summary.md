# Session Summary: Auth Architecture Planning

> Date: 2026-05-02
>
> Repo: `next-blog`
>
> Related repos discussed:
>
> - `/home/quanghuy1242/pjs/next-blog`
> - `/home/quanghuy1242/pjs/payloadcms`
> - `/home/quanghuy1242/pjs/auther`

---

## 1. What This Session Accomplished

This session did not implement code changes in the auth systems. It produced the architecture and migration planning needed before implementation.

The main outcome is that the current auth problem was reframed from:

- “how do we map a blog token to a payload token?”

to:

- “how do we separate login client identity from content authorization scope?”

The conclusion was that token mapping is the wrong abstraction. The real issue is authorization ownership and projection boundaries.

---

## 2. Main Architectural Conclusions

### 2.1 Immediate conclusion

For a dedicated blog OAuth client, the clean near-term bridge is:

- blog has its own OAuth client
- Payload remains the content authorization authority
- Auther projects blog-triggered registration-context grants into Payload-scoped tuples

This was captured as the short/medium-term implementation plan.

### 2.2 Long-term conclusion

The current system has one major conceptual overload:

- `clientId` is carrying too much meaning

It currently acts too much like:

- login app identity
- authorization namespace
- webhook routing key
- projection scope selector

The corrected long-term model should explicitly separate:

1. OAuth client
2. resource server
3. authorization space
4. projection consumer

This means:

- OAuth client semantics in `auther` stay standard and should not be repurposed
- new concepts such as `authorization space` and `resource server` must be added beside existing client types, not forced into them

### 2.3 Token conclusion

Current code reuses Better Auth JWTs in a way that behaves like a shared auth token across apps.

That is acceptable in the short term, but the clean final shape is:

- `id_token` for identity/client session bootstrap
- `access_token` for resource-server access

Long term, Payload should validate resource-server access tokens rather than rely on implicit ID-token-style reuse.

---

## 3. Important Current-State Findings

### 3.1 `next-blog`

Findings:

- blog auth extraction already accepts:
  - `Authorization: Bearer`
  - `betterAuthToken`
  - `payload-token`
  - `better-auth.session_token`
- blog already forwards bearer tokens to Payload GraphQL
- blog header is static and currently only has `About me`

Key files:

- [common/utils/auth.ts](/home/quanghuy1242/pjs/next-blog/common/utils/auth.ts:1)
- [common/apis/base.ts](/home/quanghuy1242/pjs/next-blog/common/apis/base.ts:36)
- [components/core/header.tsx](/home/quanghuy1242/pjs/next-blog/components/core/header.tsx:63)

### 3.2 `payloadcms`

Findings:

- Payload already trusts Better Auth JWTs directly via JWKS verification
- Payload callback stores the Better Auth token into:
  - `betterAuthToken`
  - `payload-token`
- Payload links users through `betterAuthUserId`
- Payload mirror only materializes `book`, `chapter`, and `comment` grants
- Payload reconcile and grant sweep are hard-wired to the configured Payload client namespace
- Payload webhook handler filters events by expected client id today
- there is a first-request risk around deferred grant drain for newly linked or newly created users

Key files:

- [src/lib/betterAuth/tokens.ts](/home/quanghuy1242/pjs/payloadcms/src/lib/betterAuth/tokens.ts:90)
- [src/app/(payload)/auth/callback/route.ts](/home/quanghuy1242/pjs/payloadcms/src/app/%28payload%29/auth/callback/route.ts:121)
- [src/collections/Users.ts](/home/quanghuy1242/pjs/payloadcms/src/collections/Users.ts:123)
- [src/lib/betterAuth/users.ts](/home/quanghuy1242/pjs/payloadcms/src/lib/betterAuth/users.ts:68)
- [src/app/api/webhooks/auther/route.ts](/home/quanghuy1242/pjs/payloadcms/src/app/api/webhooks/auther/route.ts:126)
- [src/utils/grantMirror.ts](/home/quanghuy1242/pjs/payloadcms/src/utils/grantMirror.ts:114)

### 3.3 `auther`

Findings:

- OAuth clients are already modeled correctly as OAuth clients
- current client types should not be repurposed
- registration contexts are keyed by `clientId`
- context grants are stored as `entityTypeId + relation`
- authorize flow already applies client-owned registration contexts
- context grant application resolves models by `entityTypeId`, which means cross-client target projection is already possible in practice
- current UI and validation do not fully formalize that as a first-class concept
- `full_access` exists but is not the right primary bridge for Payload browser-reader content access

Key files:

- [src/db/auth-schema.ts](/home/quanghuy1242/pjs/auther/src/db/auth-schema.ts:120)
- [src/schemas/clients.ts](/home/quanghuy1242/pjs/auther/src/schemas/clients.ts:13)
- [src/lib/auth.ts](/home/quanghuy1242/pjs/auther/src/lib/auth.ts:67)
- [src/lib/utils/oauth-authorization.ts](/home/quanghuy1242/pjs/auther/src/lib/utils/oauth-authorization.ts:17)
- [src/lib/pipelines/registration-grants.ts](/home/quanghuy1242/pjs/auther/src/lib/pipelines/registration-grants.ts:106)
- [src/lib/services/registration-context-service.ts](/home/quanghuy1242/pjs/auther/src/lib/services/registration-context-service.ts:222)
- [src/db/platform-access-schema.ts](/home/quanghuy1242/pjs/auther/src/db/platform-access-schema.ts:8)

---

## 4. Docs Created In This Session

Three primary docs were created.

### 4.1 Dedicated blog client bridge plan

[docs/blog-dedicated-client-auth-plan.md](/home/quanghuy1242/pjs/next-blog/docs/blog-dedicated-client-auth-plan.md)

Purpose:

- near-term implementation plan
- dedicated blog OAuth client
- grant projection into Payload-scoped tuples
- no token translation layer

### 4.2 Architecture correction plan

[docs/auth-architecture-correction-plan.md](/home/quanghuy1242/pjs/next-blog/docs/auth-architecture-correction-plan.md)

Purpose:

- explain why the first plan is not enough for a fully clean conceptual model
- introduce first-class separation of:
  - OAuth client
  - resource server
  - authorization space
  - projection

### 4.3 Concrete migration backlog

[docs/auth-migration-backlog.md](/home/quanghuy1242/pjs/next-blog/docs/auth-migration-backlog.md)

Purpose:

- release-by-release migration backlog across:
  - `auther`
  - `payloadcms`
  - `next-blog`
- preserves standard OAuth client semantics
- introduces new control-plane concepts beside existing clients

---

## 5. Final Recommended Direction

### 5.1 Near-term

Implement `R1` from the migration backlog:

- add dedicated blog OAuth client
- add explicit projection validation in `auther`
- allow blog-owned registration contexts to target Payload models
- add blog-owned login/callback/logout flow
- fix Payload first-request deferred-grant race

### 5.2 Medium-term

Implement `R2` and `R3`:

- add first-class `authorization space`
- add first-class `resource server`
- move Payload projection routing from client-based to space-based

### 5.3 Long-term

Implement `R4`:

- move to proper resource-server access tokens
- stop relying on implicit multi-client audience acceptance as the long-term contract

---

## 6. Important Constraints To Preserve

These were explicitly called out by the user and reflected in the docs:

1. Do not break `auther`’s OAuth client model.
2. Do not repurpose OAuth client type into resource server type.
3. Keep client types standard in shape.
4. Add new control-plane concepts beside the existing OAuth client model.
5. Avoid custom or made-up auth semantics when a standard conceptual model exists.

---

## 7. Risks Already Identified

### 7.1 First-request race

If a grant webhook lands before the Payload user exists, deferred grants can lag behind first authenticated access.

Planned fix:

- synchronous deferred-grant drain during Payload auth upsert/link path

### 7.2 Hidden projection rules

Cross-client targeting already exists implicitly through `entityTypeId` resolution.

Planned fix:

- formalize it with explicit validation and then migrate to authorization-space ownership

### 7.3 Token contract ambiguity

Current system blurs identity token vs resource access token.

Planned fix:

- keep short-term compatibility
- later move to proper resource-server access tokens

---

## 8. Recommended Next Session Starting Point

The next session should start from:

[docs/auth-migration-backlog.md](/home/quanghuy1242/pjs/next-blog/docs/auth-migration-backlog.md)

and focus on:

- `R1`

Recommended first implementation slice:

1. `auther`: add `BLOG_CLIENT_ID`
2. `auther`: add `grantProjectionClientIds` metadata
3. `auther`: add validation for projected registration-context grants
4. `auther`: expose allowed target models in registration UI/actions
5. `payloadcms`: fix synchronous deferred-grant drain on first auth upsert/link
6. `payloadcms`: temporarily accept `BLOG_CLIENT_ID` audience if needed
7. `next-blog`: add `/auth/login`, `/auth/callback`, `/auth/logout`
8. `next-blog`: add header sign-in link

If only one repo should be touched first, start with:

- `auther`

because it defines whether the dedicated blog client can cleanly project into Payload-backed authorization before any blog UI work lands.

---

## 9. Notes For The Next Agent

1. Do not revisit the “token mapping” idea unless a very specific technical blocker appears. The planning conclusion was that token mapping is the wrong abstraction.
2. Do not propose turning `resource server` or `authorization space` into OAuth client types.
3. Treat the three planning docs as the current source of truth for auth architecture direction.
4. If implementation begins, update the migration backlog with completed tasks and any deviations discovered in code.

