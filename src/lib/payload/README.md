# Payload Data Access

`src/lib/payload` is the PayloadCMS repository layer. It owns GraphQL documents,
Payload cache tags, auth-aware Payload requests, and raw CMS response normalization.

## Boundaries

- `core/*`: shared transport and cache infrastructure only.
- `books/*`: book-domain repositories. Keep catalog, page payloads, chapters,
  bookmarks, reading progress, and viewer state together here because they form
  one bounded context around book reading.
- `posts/*`: post-domain repositories. `list.ts` is collection/list access;
  `detail.ts` is single-post/detail access.
- `home/*`: homepage composition payloads. These may compose taxonomy/posts, but
  should stay focused on API payloads used by homepage surfaces.
- `taxonomy/*`: cross-content taxonomy repositories such as categories.
- `author/*`: author/profile repositories.
- `comments/*`: shared comment interaction repositories.

## Call Direction

`src/app/**/page.tsx` and `src/app/layout.tsx` should use `src/lib/server/**`
page-data modules, not payload repositories directly. Route handlers under
`src/app/api/**` may call payload repositories because they are already the HTTP
boundary for client mutations and viewer-scoped data.

Payload repositories may compose other payload repositories inside the same
domain. Cross-domain composition should usually live in `src/lib/server/**`
unless the returned data is itself a reusable Payload API contract.
