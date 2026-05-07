# Auther Onboarding Signup 11.1 Completion Audit

Date: 2026-05-07 10:34 +0700

Scope:
- `/home/quanghuy1242/pjs/auther`
- `/home/quanghuy1242/pjs/payloadcms`
- Reference checklist: `docs/auth-registration-context-blog-signup-flow.md` section 11.1

Context:
- The initial 11.1 Auther implementation was committed as `e22e226 Sign up 11.1`.
- This pass audited the whole section 11.1 checklist instead of only the Auther signup page work.
- The pass found additional gaps in direct/invite `/sign-up` entry-mode behavior and fixed them.

## Result

11.1 is code-complete across Auther and PayloadCMS.

Operational setup is still required after deploy:
- Run the Auther schema migration/push so `webhook_endpoint.authorization_space_id` exists.
- Enable the global signup modes that should be active for the release.
- Enable onboarding on the target authorization space.
- Add the target space's allowed trigger principals.
- Create the Onboarding Flow through the UI with target space, model, relation, entity scope, return URLs, domains, triggers, and theme.
- Configure the Payload webhook endpoint in Auther with the target authorization-space filter.
- Set Payload routing env to `AUTHER_USE_SPACE_ROUTING=true` and `AUTHER_AUTHORIZATION_SPACE_ID=<space-id>`.

These are deploy/configuration steps, not remaining code gaps.

## Bullet-Level 11.1 Status

| 11.1 item | Status | Implementation notes |
| --- | --- | --- |
| Add real `/sign-up` page in Auther. | Done | `src/app/sign-up/page.tsx` renders a public signup page. |
| Add generic server-side signup action/route that validates a signed signup intent and executes a UI-managed Onboarding Flow. | Done | `src/app/sign-up/actions.ts` validates signed intents and queues/applies selected flow grants. |
| Keep Better Auth raw signup internally protected; do not expose `INTERNAL_SIGNUP_SECRET` to the browser. | Done | Better Auth raw signup remains guarded by `x-internal-signup-secret`; public actions call it server-side only. |
| Add global signup policy UI and persistence. | Done | `SignupPolicySection` and `signupPolicyRepo` manage persisted policy. |
| Add a global toggle for direct Auther signup. | Done | Direct signup toggle is persisted and now enforced by `directSignUp()`. |
| Add global allowed entry modes: direct, public signed intent, invite. | Done | `/sign-up` now supports direct, signed intent, and invite modes. |
| Add authorization-space onboarding policy UI and persistence. | Done | Authorization-space form stores `onboardingEnabled` and `onboardingAllowedTriggers`. |
| Add space-level allowed trigger principals: OAuth clients and resource servers linked to that space. | Done | Server validation enforces resource-server ownership and OAuth client links with `can_trigger_contexts` or `full`. |
| Add UI fields for Onboarding Flow signup mode: disabled, public signed intent, invite only. | Done | Onboarding Flow modal has signup mode select. |
| Add UI selection for allowed trigger principals from the space-level allowlist. | Done | Onboarding Flow modal renders checkboxes from the selected space allowlist. |
| Add UI selection for target authorization space, model, relation, and entity scope. | Done | Onboarding Flow modal selects target space, models in that space, relation, and entity ID or `*`. |
| Add UI controls for allowed return URLs/origins, allowed email domains, and optional theme. | Done | Onboarding Flow modal captures all of these fields. |
| Add policy enforcement order: global policy, flow enabled, space onboarding enabled, trigger allowed by space, trigger allowed by flow, grant subset, redirect/domain/nonce checks. | Done | `RegistrationContextService.validateSignupIntent()` verifies nonce, then policy; `validateSignupIntentPolicy()` enforces global, flow, space, trigger, grant, return URL, and domain checks. |
| Fix `applyContextGrants()` to include `authorizationSpaceId`. | Done | Tuple creation passes the model's `authorizationSpaceId`. |
| Replace `findPlatformContexts()` usage with explicit target/trigger queries. | Done | Old usage was removed; repository now uses `findOnboardingFlows()` and `findInvitableOnboardingFlows()`. |
| Remove blind `queuePlatformContextGrants()` from signup/invite verification paths. | Done | Old helper is removed; only validated durable context grant queueing remains. |
| Enforce `allowedDomains`. | Done | Signed-intent and invite validation enforce email domains when configured. |
| Require non-default `INVITE_HMAC_SECRET` in production. | Done | Invite/signing service throws in production when the secret is missing or default. |
| Make invite validation and grant application fail closed when the target authorization model or relation no longer exists. | Done | `applyContextGrants()` throws if model is missing, relation is missing, or model is outside target space. |
| Add signed signup intent minting/verification for public signup initiated by any allowed trigger principal. | Done | `POST /api/auth/signup-intents` supports OAuth client and resource-server trigger principals. |
| Include flow slug, trigger principal, target auth space, requested grant subset, return URL, nonce, and expiry. | Done | `SignupIntentPayload` includes these fields. |
| Store nonce/replay state if the token can grant access. | Done | `signupIntentNonceRepo` stores and consumes nonce records. |
| Store return/OAuth continuation state. | Done | Return URL is stored on nonce and durable pending grant records. |
| Add email verification completion handling that applies the selected flow grants. | Done | Better Auth user update hook applies pending context grants once email is verified. |
| Add authorization-space-scoped webhook endpoint/subscription filtering in Auther. | Done | Webhook endpoints can filter by `authorizationSpaceId`; grant events fan out with authorization-space routing metadata. |
| Register/configure Payload's webhook endpoint as scoped to the configured content authorization space. | Done in code; deploy config required | Auther webhook UI and schema support this. The actual endpoint selection must be configured in the target environment. |
| Verify newly created flow tuples emit or otherwise trigger Payload mirror propagation. | Done | Registration grants create normal tuples through `TupleRepository.createIfNotExists()`, which emits grant webhook events with `authorizationSpaceId`. Payload route tests pass. |
| Configure Payload's Auther webhook endpoint for authorization-space routing, not client-owned routing. | Done in code; deploy config required | Payload route uses strict authorization-space routing when `AUTHER_USE_SPACE_ROUTING=true`. |
| Update Payload's mirror parser if space-native webhook events use canonical entity names such as `space_<spaceId>:book`. | Done | `parsePayloadMirrorEntityType()` strips scope prefix in space-routing mode and accepts canonical names. |
| Add a deterministic mirror bootstrap for existing users when the tuple already exists and no new `grant.created` event is emitted. | Done | Existing Payload reconcile route covers deterministic bootstrap and has integration coverage. |
| Redirect verified users back to OAuth authorize or the configured return URL. | Done | Signed-intent flow redirects signed-in verified users to the intent return URL; existing users are returned through sign-in continuation. |
| Handle existing users by applying the selected flow grants without creating a duplicate account. | Done | Existing non-session users are redirected to sign in; matching signed-in users get grants applied/queued. |
| Handle existing verified Auther users who do not yet have the target authorization-space grant. | Done | Matching verified signed-in users receive the selected context grants idempotently. |
| Require email verification before granting target-space access to existing unverified users. | Done | Unverified signed-in users get pending durable grants; grants apply on email verification update. |
| Ensure a newly signed-up public user can only access `/admin/profile` in Auther unless promoted later. | Done | Admin layout/page now allow profile-only access for non-admin users while other admin pages keep their guards. |
| Add tests for denied direct Auther signup when global direct signup is disabled. | Done | `tests/onboarding-signup-policy.test.ts` covers raw Better Auth blocking and direct action policy denial. |
| Add tests for allowed signup from one client and denied signup from another client in the same authorization space. | Done | Onboarding trigger allowlist test covers allowed and denied clients. |
| Add tests proving a new client/space/flow can be configured through data/UI without code changes. | Done | Data-configured arbitrary client/space/model/flow policy test covers this. |

## Verification

Auther:
- `pnpm run lint`
- `node --import tsx tests/onboarding-signup-policy.test.ts`

PayloadCMS:
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run --config ./vitest.config.mts tests/int/grant-mirror.int.spec.ts tests/int/auther-webhook-route.int.spec.ts tests/int/reconcile-route.int.spec.ts`

Additional checks:
- `rg -n "findPlatformContexts|queuePlatformContextGrants" src tests` in Auther returned no matches.
- `git diff --check` passed in Auther, PayloadCMS, and next-blog.

## Files Touched

Auther:
- `src/app/sign-up/page.tsx`
- `src/app/sign-up/actions.ts`
- `src/app/sign-up/sign-up-form.tsx`
- `src/app/api/auth/signup-intents/route.ts`
- `src/app/admin/access/access-client.tsx`
- `src/app/admin/access/actions.ts`
- `src/app/admin/access/page.tsx`
- `src/app/admin/authorization-spaces/actions.ts`
- `src/app/admin/authorization-spaces/authorization-space-form.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/users/invites-actions.ts`
- `src/app/admin/webhooks/*`
- `src/db/app-schema.ts`
- `src/db/platform-access-schema.ts`
- `src/lib/pipelines/registration-grants.ts`
- `src/lib/repositories/platform-access-repository.ts`
- `src/lib/repositories/tuple-repository.ts`
- `src/lib/repositories/webhook-repository.ts`
- `src/lib/services/registration-context-service.ts`
- `src/lib/types.ts`
- `src/lib/utils/registration-context-grants.ts`
- `src/lib/webhooks/delivery-service.ts`
- `src/lib/webhooks/grant-events.ts`
- `src/schemas/webhooks.ts`
- `tests/onboarding-signup-policy.test.ts`

PayloadCMS:
- `src/app/api/webhooks/auther/route.ts`
- `src/utils/grantMirror.ts`
- `tests/int/grant-mirror.int.spec.ts`

next-blog:
- `docs/states/2026-05-07-auther-onboarding-signup-11-1-full-completion.md`
