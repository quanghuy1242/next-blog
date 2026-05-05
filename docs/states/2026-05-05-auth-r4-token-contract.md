# Session Summary: Auth R4 Token Contract

> Date: 2026-05-05
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/payloadcms`
> - `/home/quanghuy1242/pjs/next-blog`
>
> Baseline:
>
> - `docs/auth-architecture-correction-plan.md`
> - `docs/auth-migration-backlog.md`

## 1. R4 Intent

R4 finishes the architecture correction by making Payload resource access use an access-token contract instead of reusing the OIDC `id_token` as an API bearer.

The corrected token roles are:

- `id_token`: identity token for the OAuth client.
- `access_token`: resource bearer for Payload.
- Payload resource audience: `payload-content-api`.
- Payload authorization space: `payload-content`.

## 2. Auther

Better Auth's built-in OIDC access token is opaque. Auther now wraps successful OAuth token responses for clients linked to the `payload-content` authorization space with `can_trigger_contexts` or `full` access.

For those clients, the token endpoint response still includes the normal `id_token`, but the returned `access_token` is a JWKS-signed JWT with:

- `iss = JWT_ISSUER`
- `aud = payload-content-api`
- `sub = Auther user id`
- `token_use = access`
- requesting client in `client_id` and `azp`
- Payload resource/space metadata

The R2 seed topology remains the source for the resource-server audience and space link.

## 3. PayloadCMS

Payload now expects the resource-server audience by default:

- `PAYLOAD_RESOURCE_SERVER_AUDIENCE=payload-content-api`

The old client-audience compatibility path is no longer automatic. It can be temporarily re-enabled with:

- `PAYLOAD_ACCEPT_CLIENT_AUDIENCES=true`

Payload's OAuth callback now stores `access_token` into the shared auth cookies.

## 4. Next Blog

The blog OAuth callback now stores `access_token` into the Payload-compatible cookies:

- `betterAuthToken`
- `payload-token`

The `id_token` may still be returned by Auther, but it is not the resource bearer sent to Payload.

## 5. Exit Criteria

R4 is complete when:

1. Payload consumes access tokens for `payload-content-api`.
2. client audience drift is only an explicit rollback option.
3. the blog callback persists the resource bearer token and existing Payload calls keep forwarding it.

