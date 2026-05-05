# Session Summary: Auth R4 Issues.md Remediation

> Date: 2026-05-05
>
> Source:
>
> - `/home/quanghuy1242/pjs/next-blog/issues.md`
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/payloadcms`
> - `/home/quanghuy1242/pjs/next-blog`

## 1. Merged Comprehensive Access Control Into Authorization Spaces

The initial fix only restored `/admin/clients/[id]/access`, which was not the right final architecture. The corrected follow-up now embeds the existing comprehensive `AccessControl` surface inside `/admin/authorization-spaces/[id]/access` for every OAuth client linked to that space.

The space access page now exposes the old full toolset for linked clients:

- API key management
- platform access list
- authorization models/schema editor
- scoped permissions for users, groups, and API keys
- grant projection client options

The previous simplification was wrong: Spaces should be the operational entry point for access control, but that does not mean removing the mature client-scoped controls. The page now keeps those controls visible at the authorization-space boundary while still respecting that API keys are owned by OAuth clients.

`/admin/clients/[id]/access` is now disabled as a duplicate UI. It redirects to the first linked authorization-space access page, or to the client Spaces page when the client has no linked spaces yet. The client detail Access Control tab was removed, and the client Spaces page now links each space directly to its authorization-space access-control page.

## 2. Fixed Authorization Space Access Crash

Fixed the `Object ID is required` Zod crash on `/admin/authorization-spaces/[id]/access`.

Space grant Resource ID now defaults to `*`, and the server action normalizes an empty Resource ID to `*`. The page no longer throws a raw Zod error for an empty object id.

## 3. Fixed Trusted OAuth Client Consent

Database-managed trusted OAuth clients were still reaching Better Auth's consent path because Better Auth only skips consent for static `trustedClients` with top-level `skipConsent`.

Auther now records consent automatically for trusted database clients before Better Auth validates the authorize request. This keeps OAuth clients UI/database-managed while making trusted first-party clients skip consent correctly.

Also added a real `/oauth-consent` page for untrusted clients, so untrusted clients no longer fail with `NO_CONSENT_PAGE_PROVIDED`.

## 4. Added Trusted Toggle On Client Edit

The OAuth client detail edit mode now includes a `Trusted first-party client` toggle.

Saving the toggle updates both:

- metadata `trusted`
- the `oauth_application.user_id` trusted/dynamic marker used by the existing list filters

## 5. Added Auther Permission Cache For Blog Reads

The slow path from next-blog was through Payload's grant mirror live-check path calling Auther `check-permission/batch`.

Payload now has a short token-scoped in-memory cache around the Auther batch check. This is the request path used when next-blog reads Payload content and Payload needs a live conditioned permission check from Auther. The cache key hashes the session token, entity type, entity ids, and context. Default TTL is 15 seconds and can be disabled or tuned with `AUTHER_PERMISSION_CACHE_TTL_MS`.

## 6. UI Component Cleanup

Updated Authorization Space and Resource Server pages to use shared project UI components instead of one-off raw controls where practical:

- `Input`
- `Select`
- `Checkbox`
- `ResponsiveTable`

The Assign Model button alignment was also corrected in the Model Ownership form.

## 7. Verification

Ran in `/home/quanghuy1242/pjs/auther`:

- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm exec tsx --test tests/*.test.ts`
- `pnpm run build`

Ran in `/home/quanghuy1242/pjs/payloadcms`:

- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm exec vitest run --config ./vitest.config.mts tests/int/grant-mirror.int.spec.ts tests/int/better-auth-token-extraction.int.spec.ts`

Ran in `/home/quanghuy1242/pjs/next-blog`:

- `pnpm run lint`
- `pnpm exec vitest run tests/components/date.test.tsx tests/components/posts.test.tsx`
- `pnpm test`

All final verification commands passed. Payload lint still emits its existing unrelated warning set. Auther build still emits the existing `baseline-browser-mapping` freshness warning.
