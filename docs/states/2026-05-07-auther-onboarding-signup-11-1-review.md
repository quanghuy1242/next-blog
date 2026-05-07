# Auther Onboarding Signup 11.1 Review

Date: 2026-05-07 01:38 +07

Scope reviewed:
- Repository: `/home/quanghuy1242/pjs/auther`
- Staged changes for `11.1 Engineering Implementation: Generic Public Onboarding Signup`
- Reference plan: `docs/auth-registration-context-blog-signup-flow.md`

Before-fix implementation rating: 5/10.

Reasoning:
- The staged patch establishes important primitives: `/sign-up`, global signup policy persistence, signed signup-intent validation, nonce storage, flow/space trigger checks, email-domain checks, return URL checks, delayed grant application after email verification, and `authorizationSpaceId` on created onboarding tuples.
- It does not fully satisfy 11.1 yet. Missing or incomplete areas are control-plane UI for authorization-space onboarding policy, real Onboarding Flow UI fields for signup mode/triggers/return URLs/domains/target space/entity scope, a public/internal API for allowed trigger principals to mint signup intents, authorization-space-scoped webhook subscription filtering, and Payload mirror bootstrap/parser verification.
- The most serious pre-fix bug was existing verified users receiving grants by email submission alone, without proving the requester controlled that account.

Unstaged fixes applied:
- Existing-account signup intent handling now requires the matching signed-in session before grants are queued/applied.
- Existing users who submit an intent while signed out are redirected to sign in and then continue the same `/sign-up?intent=...` flow.
- Signed-in users see a continue flow instead of being asked to create a duplicate account.
- Signup intent pending applications now fail closed if the intent expired before email verification completed.
- New-user pending grant queueing now happens only after the signup intent nonce is consumed and the Better Auth signup succeeds.
- Origin-based legacy helper no longer blindly queues all platform contexts.
- Updating an authorization space no longer silently resets `onboardingEnabled` and `onboardingAllowedTriggers` when the existing form does not submit those fields.

Verification run:
- `pnpm exec tsc --noEmit`
- `node --import tsx tests/onboarding-signup-policy.test.ts`

Result:
- TypeScript passed.
- Focused onboarding signup policy tests passed: 3/3.

11.1 status after this review:
- Not complete.
- The staged patch plus unstaged fixes are a useful backend start, but not handoff-complete for the full 11.1 checklist.

Remaining 11.1 engineering gaps:
- Add authorization-space onboarding policy UI and save actions so admins can enable onboarding and select allowed trigger principals per space.
- Add generic Onboarding Flow UI fields for signup mode, allowed trigger principals, target authorization space, model, relation, entity scope, allowed return URLs/origins, allowed email domains, and theme.
- Add a generic signup-intent minting endpoint/action for allowed trigger principals. It must validate the same policy chain before creating nonce state.
- Enforce direct Auther signup policy if direct signup is later exposed. Today raw Better Auth signup remains internal-only, so direct public signup is effectively disabled.
- Add tests that prove a new client/space/flow can be configured through persisted data/UI without code changes.
- Add authorization-space-scoped webhook endpoint/subscription filtering in Auther before calling the mirror path complete.
- Verify Payload mirror propagation for newly created onboarding tuples and add bootstrap/reconcile behavior for already-existing tuples that do not emit `grant.created`.

PayloadCMS and next-blog scope note:
- No next-blog application code is required for the Auther-side 11.1 implementation.
- PayloadCMS code is not required for the generic signup page itself, but the full epic is not complete until Auther's space-scoped grant webhooks and Payload's mirror/reconcile path are verified. That belongs with the Payload mirror verification backlog, not the first Auther signup-page patch.
