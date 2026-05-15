# Book Viewer State UX Optimization

> Status: implemented; targeted verification passed; full suite has one unrelated posts API assertion failure
>
> Date: 2026-05-15
>
> Scope:
>
> - `/home/quanghuy1242/pjs/next-blog`
> - `/books`
> - `/books/[slug]`
> - `/books/[slug]/chapters/[chapterSlug]`
> - `/books/shelf`
>
> Source docs:
>
> - `src/app/books/page.tsx`
> - `src/app/books/[slug]/page.tsx`
> - `src/app/books/[slug]/chapters/[chapterSlug]/page.tsx`
> - `src/app/books/shelf/page.tsx`
> - `src/lib/server/books/page-data.ts`
> - `src/lib/payload/books.ts`
> - `src/lib/payload/book-pages.ts`
> - `src/lib/payload/bookmarks.ts`
> - `src/lib/payload/reading-progress.ts`
> - `https://payload.quanghuy.dev/api/graphql`
>
> Assumptions:
>
> - Authenticated Payload GraphQL requests are cached per user where a cache setting is supplied and a stable `sub` claim is available.
> - First-release work should not change the Payload backend schema.
> - A short-lived neutral or locally inferred UI state is acceptable while server viewer state loads.

## Table Of Contents

- [1. Goal](#1-goal)
- [2. System Summary](#2-system-summary)
- [3. Current-State Findings](#3-current-state-findings)
  - [3.1 Relevant Files](#31-relevant-files)
  - [3.2 Current Behavior](#32-current-behavior)
  - [3.3 Live Schema Findings](#33-live-schema-findings)
  - [3.4 Current Problems](#34-current-problems)
- [4. Target Model](#4-target-model)
- [5. Architecture Decisions](#5-architecture-decisions)
  - [5.1 Recommended Approach](#51-recommended-approach)
  - [5.2 Rejected Or Deferred Options](#52-rejected-or-deferred-options)
- [6. Implementation Strategy](#6-implementation-strategy)
- [7. Detailed Implementation Plan](#7-detailed-implementation-plan)
  - [7.1 Shared Viewer State API](#71-shared-viewer-state-api)
  - [7.2 Books List](#72-books-list)
  - [7.3 Book Detail](#73-book-detail)
  - [7.4 Chapter Reader](#74-chapter-reader)
  - [7.5 Bookshelf](#75-bookshelf)
- [8. Migration And Rollout](#8-migration-and-rollout)
- [9. Edge Cases And Failure Modes](#9-edge-cases-and-failure-modes)
- [10. Implementation Backlog](#10-implementation-backlog)
  - [R1-A. Tracking Document](#r1-a-tracking-document)
  - [R1-B. Batched Viewer State Data Layer](#r1-b-batched-viewer-state-data-layer)
  - [R1-C. Viewer State Route Handlers](#r1-c-viewer-state-route-handlers)
  - [R1-D. Client Hydration For Books List](#r1-d-client-hydration-for-books-list)
  - [R1-E. Client Hydration For Book Detail](#r1-e-client-hydration-for-book-detail)
  - [R1-F. Client Hydration For Chapter Reader](#r1-f-client-hydration-for-chapter-reader)
  - [R1-G. Verification And Status Update](#r1-g-verification-and-status-update)
- [11. Future Backlog](#11-future-backlog)
- [12. Definition Of Done](#12-definition-of-done)
- [13. Final Model](#13-final-model)

## 1. Goal

Reduce perceived latency for authenticated users on book-related routes by removing live viewer data from the critical server-render path where it is not required to display readable content.

The first release keeps the existing Payload backend contract. It introduces frontend/API boundaries that let book and chapter content render from cached server data while bookmark state, reading progress, continue-reading state, and comments load after the main content is visible.

Non-goals for this release:

- Do not replace the per-user Payload cache design.
- Do not add a new Payload resolver.
- Do not change reading-progress write semantics.
- Do not redesign `/books/shelf`, because the whole page is private bookmark data.

## 2. System Summary

Book routes currently combine two different data categories:

- Base content: book metadata, covers, chapter lists, chapter body content, and public comment data.
- Viewer state: bookmark status, reading progress, whole-book progress, continue-reading target, and comment permissions.

Anonymous users are fast because they do not need most viewer state. Authenticated users wait for additional live data before the route can complete rendering. The target model keeps content server-rendered and moves viewer state to small authenticated endpoints that hydrate existing UI after navigation.

## 3. Current-State Findings

### 3.1 Relevant Files

- `src/app/books/page.tsx`: server-loads first page of books with `getDataForBooksPage`.
- `src/app/api/books/route.ts`: returns paginated books and currently includes authenticated progress/bookmark attachments.
- `src/app/books/[slug]/page.tsx`: server-loads `getBookPageData` and renders bookmark/progress/chapter list from that payload.
- `src/app/books/[slug]/chapters/[chapterSlug]/page.tsx`: server-loads `getChapterPageData` and passes comments/bookmark/progress into `ChapterReaderClient`.
- `src/lib/server/books/page-data.ts`: orchestrates base payload and viewer payload for book/chapter pages.
- `src/lib/payload/books.ts`: attaches whole-book progress and bookmark state to book list results.
- `src/lib/payload/book-pages.ts`: contains book/chapter base queries and authenticated supplemental queries.
- `src/hooks/useBooksFeed.ts`: refreshes authenticated book list data on focus.
- `src/hooks/useBookmark.ts`: refetches bookmark state on mount even when initial bookmark state exists.
- `src/components/pages/books/chapter-reader-client.tsx`: renders chapter content, progress, TOC, bookmark button, and comments.

### 3.2 Current Behavior

`/books`:

- Reads the auth token.
- Calls `getDataForBooksPage`.
- For authenticated users, `getDataForBooksPage` fetches books, attaches per-book progress, then attaches bookmark state.
- The client refreshes the visible list on focus for authenticated users.

`/books/[slug]`:

- Fetches cached base book/chapter content and live viewer payload in parallel.
- Still waits for both payloads before rendering the page.
- Computes continue-reading and whole-book progress on the server from viewer state.

`/books/[slug]/chapters/[chapterSlug]`:

- Fetches base chapter content first.
- Then fetches authenticated supplemental data, including reading progress, bookmark state, and comments.
- The article content waits for supplemental data even though comments render below the article.

`/books/shelf`:

- Requires authentication.
- Server-fetches bookmarks and renders the private shelf.
- This route is inherently private and does not have a useful public-content shell.

### 3.3 Live Schema Findings

The live Payload GraphQL schema at `https://payload.quanghuy.dev/api/graphql` exposes:

- `readingProgress(bookId: ID!): ReadingProgressResult`
- `bookmarks(contentType: String, contentId: ID, limit: Int, page: Int): BookmarksResult`
- `comments(chapterId: ID, postId: ID): CommentsResult`
- Collection queries `Bookmarks(where: Bookmark_where, limit: Int, page: Int)` and `ReadingProgresses(where: ReadingProgress_where, limit: Int, page: Int)`.

The introspected `Bookmark_where` and `ReadingProgress_where` inputs include relationship operators with `equals` and `in`, so the frontend app can batch visible book IDs through existing collection queries without adding a backend resolver.

### 3.4 Current Problems

- Authenticated live state blocks first content visibility on book and chapter detail routes.
- `/books` attaches viewer state to list items before first render, so list navigation waits for bookmark/progress reads.
- Chapter comments block chapter body rendering even though they are below the reader content.
- Bookmark buttons duplicate state reads on mount.
- Focus refreshes can trigger extra expensive `/api/books` requests shortly after navigation.

## 4. Target Model

Base route payloads render immediately from the existing server path:

- `/books`: book cards render without bookmark/progress badges first.
- `/books/[slug]`: book header and chapter list render first.
- `/books/[slug]/chapters/[chapterSlug]`: chapter reader body renders first.

Viewer state hydrates after render through authenticated no-store endpoints:

```json
{
  "books": [
    {
      "bookId": 123,
      "isBookmarked": true,
      "bookmarkId": 456,
      "readingProgressPct": 37
    }
  ]
}
```

```json
{
  "bookmark": { "id": 456, "contentType": "book", "book": { "id": 123, "title": "", "slug": "" }, "chapter": null },
  "readingProgress": [{ "chapterId": "789", "progress": 42, "completedAt": null, "updatedAt": "..." }],
  "readingProgressByChapterId": { "789": 42 },
  "continueReadingChapterSlug": "chapter-slug",
  "wholeBookProgress": 37
}
```

The UI may briefly show neutral state or local reading-position hints before the server response arrives. When server state arrives, it reconciles and becomes the authoritative cross-device state.

## 5. Architecture Decisions

### 5.1 Recommended Approach

Use client-side viewer-state hydration for non-critical personalization:

- It directly removes live Payload roundtrips from the server-render critical path.
- It fits existing optimistic bookmark and reading-progress behavior.
- It allows local reading-position hints for instant progress display while the cross-device server state loads.
- It avoids changing the Payload backend.

Use no-store route handlers for viewer state because the data is user-specific and mutable. Short per-user server cache can be considered later after measuring behavior.

### 5.2 Rejected Or Deferred Options

- Shared public content fetches for authenticated users: deferred. The app already supports per-user cache keys, and the current concern is live-state roundtrip latency rather than cache partitioning.
- Full server Suspense streaming: deferred. It can preserve server data ownership but requires larger route decomposition. Client hydration is a smaller first release.
- New Payload resolver for `viewerBookStates(bookIds)`: deferred. Existing collection filters can batch visible IDs.
- Local storage as authoritative progress: rejected. Local state can be stale across devices; it is only an optimistic display hint until server state arrives.

## 6. Implementation Strategy

1. Add shared data helpers for batched book viewer state and single book/chapter viewer state.
2. Add no-store route handlers under `/api/books/viewer-state` and `/api/chapters/viewer-state`.
3. Change `/books` and `/api/books` to return base books without blocking on viewer state.
4. Hydrate visible `/books` cards with viewer badges after render.
5. Change book detail route data to return base content immediately and hydrate bookmark/progress/continue-reading in a client wrapper.
6. Change chapter reader route data to return content immediately and hydrate bookmark/progress/comments in the client.
7. Keep `/books/shelf` server-rendered for now.
8. Update this document with implementation status and verification results.

## 7. Detailed Implementation Plan

### 7.1 Shared Viewer State API

Current problem:

- Viewer state is embedded inside page loaders and book list loaders.

Target behavior:

- Viewer-state helpers are callable by route handlers and return UI-ready state.

Implementation tasks:

- Add `src/lib/payload/book-viewer-state.ts`.
- Use `getChapterProgressMetadataByBookIds`, `getReadingProgressByBookIds`, and a batched `Bookmarks` query.
- Return lean UI state instead of full book records.
- Implemented `src/lib/payload/book-viewer-state.ts` with list, book detail, and chapter viewer-state helpers.

Tests:

- Add API route tests for unauthenticated and authenticated responses.
- Run `pnpm lint` and targeted Vitest suites.

### 7.2 Books List

Current problem:

- `/books` waits for per-book progress and bookmark state.

Target behavior:

- `/books` renders base books first.
- Client fetches viewer state for visible book IDs and merges `isBookmarked` and `readingProgressPct`.

Implementation tasks:

- Add an option to `getDataForBooksPage` and `getPaginatedBooks` to skip viewer attachments.
- Update `src/app/books/page.tsx` and `src/app/api/books/route.ts` to use base books for initial/list pagination.
- Update `useBooksFeed` or `BooksPageClient` to hydrate viewer state.
- Throttle focus refresh and make it refresh viewer state instead of refetching all book content.
- Implemented `includeViewerState: false` for `/books` server and API loaders.
- Implemented `BooksPageClient` viewer-state hydration and 30-second focus refresh throttling.

Tests:

- Update `tests/api/books.test.ts`.
- Update `tests/hooks/useBooksFeed.test.tsx` if hook contracts change.

### 7.3 Book Detail

Current problem:

- The route waits for bookmark and reading-progress data before rendering.

Target behavior:

- Server returns book and chapters immediately.
- Client loads bookmark, per-chapter progress, whole progress, and continue-reading target.

Implementation tasks:

- Add base-first fields or optional viewer loading to `getBookPageData`.
- Add `BookViewerStateClient` component for the bookmark button, progress badge, continue-reading link, and chapter progress map.
- Preserve local progress hints where available.
- Implemented `BookPageClient` to load bookmark/progress/continue-reading state after base content renders.
- `getBookPageData` now returns base content without awaiting the live viewer payload.

Tests:

- Add or update page/component tests for loading and hydrated states.

### 7.4 Chapter Reader

Current problem:

- Chapter content waits for bookmark, reading progress, and comments.

Target behavior:

- Chapter content renders immediately.
- Reading progress uses local state initially and reconciles with server state.
- Bookmark state and comments load after render.

Implementation tasks:

- Add `/api/chapters/viewer-state?bookId=&chapterId=` for bookmark and progress.
- Let `CommentsSection` fetch on mount instead of receiving initial data for chapter pages.
- Update `ChapterReaderClient` to accept optional initial viewer state and fetch if absent.
- Implemented `/api/chapters/viewer-state`.
- `getChapterPageData` now returns base content without awaiting bookmark/progress/comment supplemental data.
- `ChapterReaderClient` fetches bookmark/progress after render and lets comments fetch below content.
- `useReadingProgress` no longer re-runs scroll restoration when delayed server progress arrives after mount; late state updates the displayed progress without forcing a late scroll jump.

Tests:

- Update chapter page tests for the new props and comments behavior.

### 7.5 Bookshelf

Current problem:

- The page is private and bookmark-driven.

Target behavior:

- Keep current server-rendered behavior for first release.

Implementation tasks:

- No first-release code change unless tests reveal regressions from shared helper changes.

Tests:

- Manual smoke `/books/shelf` while signed in.

## 8. Migration And Rollout

No database migration is required.

Deployment is compatible with the current Payload schema. If viewer-state endpoints fail, content still renders and the UI falls back to neutral bookmark/progress states. Rollback is straightforward because the existing server-side supplemental functions remain available during the first release.

## 9. Edge Cases And Failure Modes

- Unauthenticated viewer-state request: return empty no-store state with no error.
- Invalid IDs: return `400` with a small error payload.
- Viewer-state fetch failure in the browser: keep content visible and show neutral personalization.
- Local progress newer than server progress: keep the higher progress in visual-only UI for this release, matching current monotonic progress semantics.
- Server progress newer than local progress from another device: server state overwrites or raises displayed progress when it arrives.
- Bookmark mutation during stale viewer state: optimistic mutation remains immediate; later viewer refresh should reconcile to server state.
- Locked chapter: do not fetch comments while locked; progress tracking remains disabled.

## 10. Implementation Backlog

### R1-A. Tracking Document

Scope:

- `docs/book-viewer-state-ux-optimization.md`

Tasks:

- [x] Create implementation-grade document.
- [x] Include live schema findings.
- [x] Update status after implementation.

Acceptance criteria:

- Document contains current state, target state, backlog, risks, tests, and definition of done.

Tests:

- Manual document review.

### R1-B. Batched Viewer State Data Layer

Scope:

- `src/lib/payload/book-viewer-state.ts`
- `src/lib/payload/books.ts`
- `src/lib/payload/book-pages.ts`

Tasks:

- [x] Add helpers for list, book detail, and chapter viewer state.
- [x] Keep old server-side supplemental functions available during migration.

Acceptance criteria:

- Viewer state can be fetched independently from base content.

Tests:

- `pnpm lint`

### R1-C. Viewer State Route Handlers

Scope:

- `src/app/api/books/viewer-state/route.ts`
- `src/app/api/chapters/viewer-state/route.ts`

Tasks:

- [x] Add no-store GET endpoints.
- [x] Validate query params.
- [x] Return empty state for anonymous users.

Acceptance criteria:

- Client code has one endpoint for visible book-card state and one endpoint for chapter/book detail state.

Tests:

- `tests/api/*viewer-state*.test.ts`

### R1-D. Client Hydration For Books List

Scope:

- `src/app/books/page.tsx`
- `src/app/api/books/route.ts`
- `src/components/pages/books/books-page-client.tsx`
- `src/hooks/useBooksFeed.ts`

Tasks:

- [x] Return base books without blocking on viewer attachments.
- [x] Hydrate visible book-card progress/bookmark state.
- [x] Refresh viewer state, not whole book content, on focus.

Acceptance criteria:

- `/books` content render no longer depends on live progress/bookmark reads.

Tests:

- `tests/api/books.test.ts`
- `tests/hooks/useBooksFeed.test.tsx`

### R1-E. Client Hydration For Book Detail

Scope:

- `src/app/books/[slug]/page.tsx`
- `src/lib/server/books/page-data.ts`
- `src/components/pages/books/*`

Tasks:

- [x] Do not await book viewer payload in server route data.
- [x] Hydrate bookmark/progress/continue-reading in client UI.

Acceptance criteria:

- `/books/[slug]` renders header and chapter list before viewer state is available.

Tests:

- Existing page/component tests plus `pnpm lint`.

### R1-F. Client Hydration For Chapter Reader

Scope:

- `src/app/books/[slug]/chapters/[chapterSlug]/page.tsx`
- `src/components/pages/books/chapter-reader-client.tsx`
- `src/components/shared/comments/CommentsSection.tsx`

Tasks:

- [x] Do not await authenticated supplemental payload for initial chapter render.
- [x] Fetch bookmark/progress after render.
- [x] Fetch comments on mount below chapter content.

Acceptance criteria:

- Chapter body render no longer waits for bookmark/progress/comment reads.

Tests:

- Existing chapter page/comment tests plus `pnpm lint`.

### R1-G. Verification And Status Update

Scope:

- `docs/book-viewer-state-ux-optimization.md`
- Test suite

Tasks:

- [x] Run targeted tests.
- [x] Run `pnpm lint`.
- [x] Update this document status and backlog checkboxes.

Acceptance criteria:

- Tests pass or failures are documented with concrete cause.

Tests:

- `pnpm lint`
- Targeted Vitest suites for touched APIs/hooks/components.

Verification results:

- Passed: `pnpm lint`
- Passed: `pnpm test tests/api/books.test.ts tests/api/books-viewer-state.test.ts tests/api/chapters-viewer-state.test.ts tests/hooks/useBooksFeed.test.tsx tests/pages/chapter-page.test.tsx tests/utils/reading-progress.test.ts`
- Full-suite note: `pnpm test` currently fails in `tests/api/posts.test.ts` because the test expects `tags: null` while the posts API passes `tags: []`. This is outside the book viewer-state change set.

## 11. Future Backlog

- Add a backend `viewerBookStates(bookIds)` resolver if collection-filter batching is still too slow.
- Add short per-user stale cache for viewer-state GETs after measuring mutation/focus behavior.
- Add route prefetch for viewer state on link hover or viewport entry.
- Add timestamped local reading-position reconciliation instead of max-progress reconciliation.
- Add skeleton UI polish if neutral state flicker is too visible.

## 12. Definition Of Done

- `/books`, `/books/[slug]`, and chapter pages render base content without waiting on live authenticated viewer state.
- Viewer state hydrates correctly for authenticated users.
- Anonymous users keep the current fast behavior and do not see bookmark/progress controls.
- Comments on chapter pages no longer block chapter content rendering.
- Existing bookmark and reading-progress mutations still work.
- `pnpm lint` passes.
- Relevant API/hook/component tests pass or any unrelated failures are documented.
- This document is updated with final implementation status.

## 13. Final Model

Book content remains server-rendered and cache-friendly. Authenticated personalization becomes an enhancement layer loaded after navigation through small no-store endpoints. Local reading position can make the UI feel immediate, but server viewer state remains the cross-device source of truth once it arrives.
