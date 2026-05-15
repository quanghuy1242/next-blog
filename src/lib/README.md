# Library Architecture

`src/lib` is organized by architectural role first, then by domain.

## Top-Level Layers

- `client/`: browser-only persistence and client runtime adapters.
- `domain/`: pure product/domain rules that can be used by UI, payload
  repositories, hooks, or server loaders.
- `integrations/`: third-party adapters that are not product domain logic.
- `payload/`: PayloadCMS repository layer and Payload-specific cache/transport.
- `server/`: server-only request adapters, route/page orchestration, metadata
  builders that depend on server context, and App Router page-data loaders.
- `shared/`: cross-domain, runtime-agnostic helpers.

## Import Direction

- `domain` and `shared` should not import `payload`, `server`, `client`, or
  `integrations`.
- `payload` may import `domain` and `shared`, but should keep Payload GraphQL and
  CMS normalization inside `payload`.
- `server` may compose `payload`, `domain`, and `shared`.
- `client` may import `domain` and `shared`, but should not import `server` or
  `payload`.
- App routes/pages should prefer `server` page-data modules. API route handlers
  may call `payload` repositories directly because they are HTTP boundaries.

When adding a new helper, choose the narrowest meaningful home. For example,
book URL parsing belongs in `domain/books/routes.ts`, not `shared`, because it
encodes product routing rules rather than generic string handling.
