# App Router Migration Improvements

> Status: Implemented incremental improvements; Playwright intentionally excluded
> Date: 2026-05-14
> Scope: `/home/quanghuy1242/pjs/next-blog` App Router pages, shared UI, hooks, Payload loaders, and migration backlog follow-up

## Table Of Contents

- [Goal](#goal)
- [Current-State Findings](#current-state-findings)
- [Implemented Changes](#implemented-changes)
- [Technical Decisions](#technical-decisions)
- [Remaining Backlog](#remaining-backlog)
- [Risks And Edge Cases](#risks-and-edge-cases)
- [Test And Verification Plan](#test-and-verification-plan)
- [Definition Of Done](#definition-of-done)
- [Final Model](#final-model)

## Goal

Improve the App Router migration without adding Playwright. The work focuses on the highest-value items from the architecture review:

- Server-render initial comment data where safe.
- Reduce duplicate page-data work between `generateMetadata` and page render.
- Split public CMS data from authenticated overlays where this can be done without changing UI behavior.
- Reduce client-rendered image markup for non-interactive image surfaces.
- Keep broad shared/client components away from unnecessary App Router navigation hooks.
- Preserve existing comment/bookmark API routes instead of introducing Server Actions without a concrete UX win.

## Current-State Findings

The migration is functionally complete and all routes live under `src/app`. Remaining rough edges are mostly from Pages Router-era client patterns that are still valid but not ideal in App Router.

- `src/app/posts/[slug]/page.tsx`, `src/app/books/[slug]/page.tsx`, `src/app/books/[slug]/chapters/[chapterSlug]/page.tsx`, `src/app/about/page.tsx`, and `src/app/categories/page.tsx` performed equivalent data loads in both metadata and page render paths.
- `src/components/shared/comments/CommentsSection.tsx` accepted `initialData`, but post and chapter pages did not pass initial comments, so comments always rendered through a client fetch.
- `src/app/books/page.tsx` used auth-scoped data loading for the whole initial book list when a user was signed in, even though most of the book list is public CMS data.
- `src/components/shared/responsive-image.tsx` is a client component. Importing it into `CoverImage`, `BookCover`, and Lexical upload rendering made non-interactive image markup client-rendered.
- `src/components/pages/books/chapter-reader-client.tsx` used `usePathname()` and `useSearchParams()` only to reconstruct the current URL during chapter unlock refresh.
- Comment/bookmark APIs under `src/app/api/comments/*` and `src/app/api/bookmarks/*` are stable browser contracts with existing hooks and tests.

## Implemented Changes

### Server Initial Comments

`src/app/posts/[slug]/page.tsx` now fetches public initial comments with `getComments({ postId })` and passes them to `CommentsSection`.

`src/app/books/[slug]/chapters/[chapterSlug]/page.tsx` now fetches initial chapter comments after access is resolved. It passes auth token and chapter password proof where available, and skips this for locked chapters.

`src/components/shared/comments/comments-section-client.tsx` and `src/hooks/useComments.ts` now accept:

- `initialData`
- `refreshOnMount`

Post comments keep `refreshOnMount` enabled because the server-side initial data is intentionally public and the client may need to update authenticated capabilities. Chapter comments use `refreshOnMount={false}` because the server page already knows the authenticated/proof-scoped viewer state for that request.

### Request-Level Loader Memoization

The following pages now use `React.cache` for page-data functions that are shared by metadata and page render paths:

- `src/app/page.tsx`
- `src/app/about/page.tsx`
- `src/app/categories/page.tsx`
- `src/app/posts/[slug]/page.tsx`
- `src/app/books/[slug]/page.tsx`
- `src/app/books/[slug]/chapters/[chapterSlug]/page.tsx`

This is request-scoped memoization. It does not replace Cloudflare cache or introduce durable caching semantics.

### Public/Private Books Page Split

`src/app/books/page.tsx` now loads the initial public book list through `getDataForBooksPage(6, { cache: ONE_HOUR_PAYLOAD_CACHE })` regardless of authentication.

Authenticated overlays are fetched separately:

- Book bookmarks through `getBookmarks`.
- Chapter metadata through `getChapterProgressMetadataByBookIds`.
- Reading progress through `getReadingProgress`.
- Whole-book progress through `calculateWholeBookProgress`.

This preserves the existing UI while avoiding auth-scoped cache entries for public book list data.

### Server Image Markup

Added `src/components/shared/responsive-image-markup.tsx` as a server-rendered companion to the existing client `ResponsiveImage`.

Switched these non-interactive image surfaces to server markup:

- `src/components/shared/cover-image.tsx`
- `src/components/shared/book-cover.tsx`
- `src/components/shared/lexical-renderer.tsx`

The existing `src/components/shared/responsive-image.tsx` remains for places that need intersection observer or loaded-state behavior.

### Navigation Hook Containment

`src/components/pages/books/chapter-reader-client.tsx` no longer imports `usePathname()` or `useSearchParams()`. The unlock refresh handler now uses `window.location.pathname` and `window.location.search`, which is sufficient because it only runs in a browser event handler.

### API Route Preservation

No Server Actions were added. Existing API routes remain the stable contract for comments and bookmarks:

- `src/app/api/comments/route.ts`
- `src/app/api/comments/[commentId]/route.ts`
- `src/app/api/bookmarks/route.ts`
- `src/app/api/bookmarks/[bookmarkId]/route.ts`

This avoids duplicating mutation paths while preserving existing hook behavior and external API compatibility.

## Technical Decisions

### Use `React.cache`, Not `cacheComponents`

`React.cache` is appropriate here because the duplicate-load issue is local to a single request/render path. It avoids changing route prerender semantics.

`cacheComponents` and `'use cache'` are intentionally not enabled in this pass because the app still has mixed public, authenticated, draft, and chapter-proof-scoped data.

### Initial Post Comments Stay Public

Post pages currently avoid reading auth cookies in the server page. Fetching authenticated comments in `src/app/posts/[slug]/page.tsx` would make the route dynamic. The chosen model gives a server-rendered public comment list first, then lets the client refresh capabilities for signed-in users.

### Chapter Comments Can Be Request-Scoped

Chapter pages already resolve session token, draft mode, and chapter proof. Passing those values to `getComments` does not introduce a new dynamic behavior class for the route.

### Keep Server Actions Deferred

The existing comment/bookmark hooks already call Route Handlers. Adding Server Actions would not remove those API contracts and would create two mutation paths unless a larger form/progressive-enhancement rewrite is planned.

## Remaining Backlog

- Consider a fuller public/private split for book and chapter detail routes if the app later targets Partial Prerendering.
- Consider Cache Components only after identifying which CMS reads are strictly public and cache-safe.
- Add on-demand revalidation if Payload can send signed webhooks and the target cache layer is clear.
- Keep the existing API routes unless Server Actions can replace a full client mutation path without duplicating behavior.

## Risks And Edge Cases

- Server-rendered public post comments may briefly show `viewerCanComment: false` until the client refresh runs for authenticated users.
- Chapter initial comments depend on chapter access resolution. Locked chapters intentionally skip comments until unlock and refresh.
- The server image markup does not track loaded state. It renders stable markup immediately and relies on native browser lazy loading instead of intersection observer gating.
- The public/private `/books` split preserves initial progress by recomputing authenticated overlays separately. If reading-progress payloads grow significantly, this path may need batching at the Payload API layer.
- `React.cache` only deduplicates within the current render/request context. It is not a durable cache.

## Test And Verification Plan

Required commands:

```bash
pnpm lint
pnpm test
pnpm build
```

Focused checks:

- `tests/hooks/useComments.test.tsx` verifies initial comment data behavior.
- Existing chapter, posts, books, and comments tests cover rendering contracts.
- Manual smoke should verify:
  - Public post comment list appears before client refresh.
  - Signed-in post comments still show comment composer after refresh.
  - Chapter comments render for accessible chapters.
  - Locked chapter unlock still refreshes the current route.
  - Books page still shows bookmark and reading progress overlays for signed-in users.

## Definition Of Done

- Initial comments can be rendered from server data where safe.
- Metadata/page duplicate loaders are request-memoized.
- `/books` public list data is separated from authenticated overlays.
- Non-interactive shared image surfaces no longer require the client `ResponsiveImage`.
- Unnecessary `useSearchParams` usage is removed from the chapter reader.
- Existing comment/bookmark API contracts remain intact.
- `pnpm lint`, `pnpm test`, and `pnpm build` pass.

## Final Model

The app remains an App Router application with conservative caching and stable API contracts. The implemented changes reduce client waterfalls and unnecessary client rendering without adopting global `cacheComponents`, PPR, or Server Actions. Public CMS data and authenticated overlays are more clearly separated, while private/draft/proof-scoped behavior remains explicit and request-bound.
