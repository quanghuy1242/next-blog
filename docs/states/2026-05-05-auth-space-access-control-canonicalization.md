# Session Summary: Authorization Space Access Control Canonicalization

> Date: 2026-05-05
>
> Repos touched:
>
> - `/home/quanghuy1242/pjs/auther`
> - `/home/quanghuy1242/pjs/next-blog`

## Outcome

The authorization-space access page no longer renders one access-control panel per linked OAuth client.

It now resolves a single canonical backing client for the space:

- prefer the linked OAuth client that owns models assigned to the authorization space
- fall back to a linked `full` client only when no model-owner client exists
- fall back to the first linked client only when neither of the above exists

For the current live data, this selects:

- OAuth client: `DXJSQZpOEXTzlskMNQUERHdrKhTbTQrq`
- Authorization space: `payload-content`
- Model: `client_DXJSQZpOEXTzlskMNQUERHdrKhTbTQrq:book`

This keeps the existing Better Auth API-key storage requirement while moving the UI and write path to the authorization-space boundary.

## Code Changes

- Added canonical backing-client resolution for authorization spaces.
- Reworked `/admin/authorization-spaces/[id]/access` to show one access-control panel for the space instead of a mapped panel per linked client.
- Added authorization-space-aware API-key creation, listing, scoped grants, full-access grants, and model updates.
- Hidden transitional grant-projection client metadata from the authorization-space access panel.
- Updated UI copy so space-level API keys and full access no longer describe themselves as client-level controls.
- Preserved legacy client full-access behavior while also supporting `authorization_space` full-access grants.

## Live Data Backfill

Using Auther `.env.local`, live data was checked and backfilled:

- Backfilled `authorization_space_id` on two existing `book` grants.
- Added `authorization_space_id` metadata to the existing `PayloadCMS` API key.
- Left the unrelated `Payload SPA` Runner key outside the space.

## Notes

The underlying model entity type still includes the historical client prefix because the existing permission check and Payload integration use that stable entity type. The operational owner is now the authorization space; the canonical backing client is only the storage bridge for the current Better Auth API-key implementation and existing model names.
