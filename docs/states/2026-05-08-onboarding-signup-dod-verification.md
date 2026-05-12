# Onboarding Signup DoD Verification

Date: 2026-05-08 19:52 +0700

Scope:
- `/home/quanghuy1242/pjs/auther`
- `/home/quanghuy1242/pjs/payloadcms`
- `/home/quanghuy1242/pjs/next-blog`
- Plan: `docs/auth-registration-context-blog-signup-flow.md` section 12

Context:
- 11.1 was treated as implemented.
- 11.2 admin setup was treated as already completed through UI, per user note.
- This pass verified the three codebases against the 12.x Definition Of Done and fixed the remaining code/test gap needed for blog-initiated signup.

## Result

Code verification is complete for the generic signup engine, Payload mirror path, and blog signup entrypoint.

Live environment smoke is still required for the actual configured 11.2 records:
- global signup policy enabled for signed intents
- target authorization space onboarding enabled
- trigger principal allowed by both space and flow
- if the browser blog OAuth client is public/PKCE with no secret, a dedicated server-only signup trigger client must be linked to the same space and selected on the flow
- Payload webhook endpoint scoped to the content authorization space
- `next-blog` signup trigger env populated with server-only credentials
- real email verification and webhook delivery exercised in the deployed/local integrated environment

## Fixes Applied

Auther:
- Added explicit DoD edge-case tests for disabled flow, wrong target space, invalid relation, invalid redirect, invalid email domain, expired signup token, and replayed signup token.

next-blog:
- Added `common/utils/blog-signup.ts` for server-side signup intent creation against Auther `POST /api/auth/signup-intents`.
- Added redirect-only `pages/auth/signup.tsx`.
- Added server-only signup env examples.
- Added header `Create account` CTA to `/auth/signup`.
- Fixed header `hardNavigate` propagation so auth routes use hard navigation as intended.
- Added focused tests for signup helper, signup route, and header CTA.

PayloadCMS:
- No code changes required. Existing space-routing webhook, deferred grant, and reconcile tests cover the DoD mirror path.

Plan notes:
- Updated the plan to make the blog-side signup intent entrypoint explicit in first blog setup.
- Added notes that approval flow and platform promotion are future backlog, not first-release blockers.

## Verification Commands

Auther:
- `pnpm exec tsc --noEmit`
- `node --import tsx tests/onboarding-signup-policy.test.ts tests/tuple-repository.grant-webhook-gating.test.ts`

PayloadCMS:
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run --config ./vitest.config.mts tests/int/grant-mirror.int.spec.ts tests/int/auther-webhook-route.int.spec.ts tests/int/reconcile-route.int.spec.ts tests/int/deferred-grants.int.spec.ts`

next-blog:
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run tests/utils/blog-signup.test.ts tests/pages/auth-signup.test.ts tests/components/header.test.tsx`

All commands passed.

## DoD Notes

- 12.1 Policy/control plane: verified in Auther code/tests and existing UI surfaces.
- 12.2 Generic onboarding engine: verified in Auther; next-blog now has the server-side entrypoint needed to initiate the configured blog flow.
- 12.3 Grant correctness: verified by Auther policy/grant target tests.
- 12.4 Payload mirror projection: verified by Payload integration tests for space routing, wrong-space skip, deferred grants, and reconcile repair.
- 12.5 First blog configuration: code path is ready; the actual configured admin records are assumed complete per user note and still need live smoke in the target environment.
- 12.6 Verification: automated coverage is now present for the listed denial/edge cases except the final live email/webhook smoke, which cannot be proven from isolated repo tests.
