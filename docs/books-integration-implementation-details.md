# Homepage Categories + Bookshelf Integration Implementation Details

## 1. Purpose

This document is the implementation blueprint for the following product goals:

1. Keep the existing desktop category sidebar behavior, but redesign mobile/narrow-screen categories as a horizontal, scrollable top section with left/right controls.
2. Add a Books CTA block on homepage (desktop: above category sidebar) that opens a dedicated bookshelf page.
3. Add a new books listing route at `/books` with grid + infinite scrolling, constrained to the same visual width as the homepage posts column.
4. Add a book detail page at `/books/:slug` with metadata + ordered chapter list.
5. Add a chapter reader at `/books/:slug/chapters/:chapter-slug`, reusing current post rich-text rendering, plus chapter ToC sidebar (desktop) and drawer/modal (mobile).

No code is included in this file; this is a detailed design and execution plan.

## 2. Current State (Codebase Read)

### Homepage and category behavior now

- `pages/index.tsx` renders:
  - Left/main section: `Latest Posts` + `Posts` + infinite-loading sentinel.
  - Right/sidebar section: `Categories` list under `Text("Categories")`.
- `components/shared/categories.tsx` renders a vertical stack of category cards.
- Category description currently appears on hover only (`onMouseOver`/`onMouseLeave` local state).
- Mobile experience issue: categories are below the long/infinite posts list and are hard to reach.

### Infinite scrolling now

- `hooks/useHomePosts.ts` owns filter-aware post pagination state.
- `hooks/useIntersectionObserver.ts` powers the sentinel intersection trigger.
- `pages/api/posts.ts` serves paginated posts payloads.

### Post detail renderer now

- `pages/posts/[slug].tsx` builds post detail page.
- `components/pages/posts_slugs/post-content.tsx` uses `LexicalRenderer`.
- `components/shared/lexical-renderer.tsx` is already the reusable read-only rich text renderer.

### Books/chapters now

- `docs/book-integration.md` defines GraphQL usage recommendations for books/chapters.
- The PayloadCMS backend repo now includes real collection implementations in `src/collections/Books.ts` and `src/collections/Chapters.ts`, and both collections are registered in `src/payload.config.ts`.
- Generated types in `src/payload-types.ts` confirm the actual field contracts for `Book` and `Chapter`.
- There is no implemented frontend route/component/API layer for books/chapters in this Next.js app yet.
- `types/cms.ts` currently has no `Book` or `Chapter` interfaces.
- The checked-in schema snapshot in this repo does not include `Books`/`Chapters` types, so the frontend plan must stay aligned to the live PayloadCMS backend contract instead of the stale snapshot.

## 3. Constraints and Design Principles

1. Reuse existing architecture:
   - Keep GraphQL read path in `common/apis/*`.
   - Keep pagination and query normalization patterns consistent with posts.
   - Reuse `useIntersectionObserver` and `LexicalRenderer`.
2. Utilities-first:
   - Add reusable helpers/hooks instead of embedding logic in page files.
3. Layout consistency:
   - Preserve homepage desktop composition.
   - Keep books listing content width aligned to post column width (not full container + sidebar width).
4. Accessibility:
   - Mobile carousel controls must be keyboard/screen-reader reachable.
   - Drawer/modal ToC must support focus trap and close controls.

## 4. Route and Path Design

## 4.1 Homepage

- Existing: `/`
- Additions:
  - Mobile top section for category carousel.
  - Desktop Books CTA above category sidebar categories.

## 4.2 Books listing

- New route: `/books`
- Purpose: infinite-scroll grid of books.
- Width policy: content container should match the effective width of the homepage posts area.
- Book slugs in the backend are generated with a randomized suffix and are locked after publish, so every CTA/card/route must use the exact slug from the API response rather than re-deriving it on the client.

## 4.3 Book detail

- New route: `/books/[slug]`
- Purpose: show book metadata + chapter list.
- The page should treat the book slug as the stable public identifier for the bookshelf experience.

## 4.4 Chapter reader

- New route: `/books/[slug]/chapters/[chapterSlug]`
- Purpose: show chapter content and book-level chapter ToC.
- Chapter slugs are generated from the title and preserved after publish, but they are not globally unique in the data model. The resolver for this route must scope chapter lookup by book slug plus chapter slug, not chapter slug alone.

## 5. UX Design and Behavior

## 5.1 Category section redesign (Requirement #1)

### Desktop (md and up)

- Keep current sidebar placement and vertical stacking.
- Keep hover reveal behavior for category subtext.
- Add keyboard parity:
  - Reveal subtext on focus-visible as well as hover.

### Mobile / narrow

- Move category navigation near top of homepage, above `Latest Posts`.
- Render categories as horizontal carousel rail (single row, swipe/scroll).
- Category text + description are always visible (no hover dependency).
- Include left and right arrow buttons as explicit affordances.
- Buttons should:
  - Scroll by one card width or ~80% viewport chunk.
  - Disable when already at start/end.
  - Remain visible on top of rail.

### Visual and interaction specifics

- Card style should be visually aligned with existing category cards (image + overlay text).
- Use `scroll-snap-type: x mandatory` and card `scroll-snap-align: start`.
- Ensure touch drag + mouse wheel horizontal behavior works.
- Optional visual cue: gradient fade at rail edges.

## 5.2 Homepage Books CTA block (Requirement #2)

### Desktop placement

- In homepage sidebar column (`md:w-1/3`), insert a new block above categories:
  - Header text: `Books`.
  - One large banner/card that links to `/books`.

### CTA content

- Primary text: `Books`.
- Subtext: short supporting copy (examples):
  - `Open the bookshelf`
  - `Read long-form stories`
- Style should mirror category-card visual language (cover image + overlay text).
- On desktop, this is a dedicated CTA panel above the category stack; on mobile, it becomes one of the same horizontal category-style cards inside the rail.

### Mobile behavior

- Keep requirement guaranteed on desktop.
- On mobile, treat Books as one of the category blocks inside the same horizontal rail.
- Use the same card treatment and interaction model as the category items, but point the card to `/books` and label it clearly as Books with subtext.

## 5.3 Books listing page `/books` (Requirement #3)

### Layout

- Use standard `Layout` + `Container` pattern.
- Restrict main content width to post-column equivalent:
  - Same effective width as homepage posts region.
  - Do not consume sidebar width.
- If chapter counts are shown on the grid, do not compute them with a per-card query loop; either batch them or defer them to the book detail page to avoid an N+1 load pattern.

### Content

- Header/title section for Books page.
- Grid of book cards:
  - Mobile: 1 column.
  - Tablet/desktop: 2 columns (or 3 only if still visually consistent with post-column width).

### Infinite scrolling

- Use sentinel-based loading with existing `useIntersectionObserver`.
- Add dedicated books pagination hook, mirroring `useHomePosts` behavior for request state and dedupe.

## 5.4 Book detail `/books/[slug]` (Requirement #4)

### Page structure

1. Hero/header block:
  - Cover image
  - Title
  - Author
  - Provenance/status summary built from the real backend axes:
    - `origin` (`manual`, `epub-imported`, `synced`)
    - `syncStatus` (`clean`, `pending`, `conflicted`, `diverged`)
    - `importStatus` (`idle`, `importing`, `ready`, `failed`)
2. Overview block:
  - Optional description/origin timestamps
  - Optional import progress summary using `importTotalChapters` and `importCompletedChapters`
  - Optional failure summary using `importErrorSummary`
3. Ordered chapters block:
  - List all chapters sorted by `order`
  - Each chapter links to `/books/[slug]/chapters/[chapterSlug]`

### Behavior

- If book slug not found -> 404.
- If book exists but no chapters -> render empty-state with clear message.
- Treat `sourceType`, `sourceId`, `sourceHash`, `sourceVersion`, `importBatchId`, `importStartedAt`, `importFinishedAt`, `importFailedAt`, `lastImportedAt`, and `createdBy` as detail- or debug-level metadata, not all as primary hero content.

## 5.5 Chapter reader `/books/[slug]/chapters/[chapterSlug]` (Requirement #5)

### Rendering tech

- Reuse the existing `LexicalRenderer` pipeline currently used by post detail, but validate it against the chapter-specific node registry used in the backend.
- Content area width should remain centered and comparable to post detail reading width.
- Backend chapter content is built from a dedicated chapter Lexical node set (`paragraph`, `text`, `line break`, headings, quotes, links/autolinks, lists, tables). That means the chapter reader should explicitly verify rendering for those elements and not assume post-only extras like YouTube or code blocks are present.

### Desktop ToC behavior

- Render chapter ToC as a left-side panel.
- Keep article content visually centered, not pushed into a narrow edge column.
- Highlight current chapter in ToC.

### Mobile ToC behavior

- Replace side panel with trigger button (`Table of contents`).
- Open ToC in drawer or modal.
- Allow close via button, backdrop click, and Escape.

### Recommended reading navigation

- Include previous/next chapter links under content body for flow continuity.

## 6. Data, API, and Type Design

## 6.1 Type additions (`types/cms.ts`)

Add strongly typed models for reuse across API and components.

- `Book`
  - Source-of-truth fields from the backend: `title`, `author`, `slug`, `cover`, `origin`, `sourceType`, `sourceId`, `sourceHash`, `sourceVersion`, `syncStatus`, `importBatchId`, `importStatus`, `importTotalChapters`, `importCompletedChapters`, `importStartedAt`, `importFinishedAt`, `importFailedAt`, `lastImportedAt`, `importErrorSummary`, `createdBy`, timestamps, `_status`.
- `Chapter`
  - Source-of-truth fields from the backend: `title`, `book`, `order`, `slug`, `chapterSourceKey`, `chapterSourceHash`, `importBatchId`, `manualEditedAt`, `content`, `createdBy`, timestamps, `_status`.
- `Book` slug semantics:
  - generated from title with a randomized suffix and immutable after publish.
- `Chapter` slug semantics:
  - generated from title, preserved after publish, and not guaranteed unique across all books.
- `BooksPageData`, `BookDetailData`, `ChapterDetailData` as page payload helpers

## 6.2 API modules

Follow existing pattern in `common/apis/posts.ts` and `common/apis/posts.slug.ts`.

- New `common/apis/books.ts`
  - `getBooksPage({ limit, skip })`
  - `getBookBySlug(slug)`
  - `getChaptersByBookId(bookId)`
  - Optional composed helper `getBookDetailBySlug(slug)`
- New `common/apis/chapters.ts` (optional split if file size grows)
  - `getChapterBySlug(chapterSlug)`
  - `getChapterByBookAndSlug(bookSlug, chapterSlug)` for route safety
- The API layer should continue using the authenticated Payload GraphQL client pattern already in `common/apis/base.ts`, because the backend `Books` and `Chapters` collections are read-protected with authenticated access.
- Query selection should mirror the generated `BooksSelect` and `ChaptersSelect` shapes so the frontend only requests fields the backend actually exposes.

## 6.3 API route for client-side pagination

- New `pages/api/books.ts`
  - Query params: `limit`, `offset`
  - Returns: `{ books, hasMore, nextOffset }`
  - Input normalization should reuse `normalizeLimit` and `normalizeOffset`.

## 6.4 Query contract and preconditions

- `docs/book-integration.md` assumes Payload exposes `Books` and `Chapters` GraphQL collections.
- The backend repo confirms those collections exist and are registered in `payload.config.ts`.
- The current frontend implementation must still verify the live GraphQL schema at runtime because the checked-in schema snapshot here is stale.
- If field names differ between the blog app and the live backend, align the frontend query + types to the backend as source of truth.
- The chapter reader route must resolve chapter records with both the book slug and chapter slug, because chapter slugs are not globally unique.

## 7. Component and File Plan

## 7.1 Homepage and categories

### Modify

- `pages/index.tsx`
  - Render mobile category rail above posts section.
  - Keep desktop sidebar categories.
  - Inject desktop Books CTA above categories.

- `components/shared/categories.tsx`
  - Refactor into reusable primitives with display variants:
    - desktop sidebar card behavior
    - mobile rail card behavior

### Create

- `components/shared/categories-rail.tsx`
  - Horizontal rail wrapper + left/right controls + scroll state.

- `components/shared/books-cta-card.tsx`
  - Reusable Books banner card linking to `/books`.

## 7.2 Books listing

### Create

- `pages/books/index.tsx`
- `hooks/useBooksFeed.ts` (or equivalent name)
- `components/shared/books-grid.tsx`
- `components/shared/book-card.tsx`

## 7.3 Book detail

### Create

- `pages/books/[slug].tsx`
- `components/pages/books/book-header.tsx`
- `components/pages/books/chapter-list.tsx`

## 7.4 Chapter reader

### Create

- `pages/books/[slug]/chapters/[chapterSlug].tsx`
- `components/pages/books/chapter-content.tsx` (wraps `LexicalRenderer`)
- `components/pages/books/chapter-toc.tsx`
- `components/pages/books/chapter-toc-drawer.tsx`

## 7.5 Data layer

### Create/Modify

- `types/cms.ts` (add `Book`, `Chapter`, and page payload types)
- `common/apis/books.ts` (new)
- `common/apis/chapters.ts` (new or fold into books API file)
- `pages/api/books.ts` (new)

## 8. Responsive Layout Plan

## 8.1 Homepage

- Keep current desktop two-column structure.
- Mobile ordering:
  1. Banner
  2. Mobile categories rail
  3. Latest posts
  4. Infinite posts list

## 8.2 Books list page

- Use single central content column equivalent to home posts width.
- Avoid right sidebar region entirely.

## 8.3 Chapter reader page

- Desktop:
  - Two-region layout (ToC + content) with content centered and comfortable reading width.
- Mobile:
  - Single-column reading area.
  - ToC drawer trigger fixed near top content controls.

## 9. State and Interaction Plan

## 9.1 Mobile category rail controls

- Track scroll container metrics (`scrollLeft`, `scrollWidth`, `clientWidth`).
- Derive `canScrollLeft` and `canScrollRight` button states.
- Update on:
  - mount
  - resize
  - scroll event

## 9.2 Books infinite list

- Reuse `useHomePosts` architecture ideas:
  - `items`, `offset`, `hasMore`, `isFetching`, `error`.
  - dedupe by `slug`.
  - sentinel-triggered `loadMore`.

## 9.3 Chapter page ToC state

- Desktop: no modal state needed (always visible).
- Mobile: `isTocOpen` state for drawer/modal.

## 10. SEO and Metadata Plan

- Extend existing `renderMetaTags` patterns:
  - `/books`: title/description for bookshelf.
  - `/books/[slug]`: book title + summary.
  - chapter page: chapter title + book context.
- Canonical URL pattern should match route hierarchy.

## 11. Accessibility Plan

1. Carousel arrows:
   - `button` elements with descriptive `aria-label`.
   - Disabled state when no further scroll.
2. Category/book cards:
   - Full-card links with clear text labels.
3. ToC drawer/modal:
   - focus trap, Escape support, and close button.
4. Hover-only behaviors:
   - preserve desktop hover, but do not rely on hover for mobile discoverability.

## 12. Testing Plan

## 12.1 Unit/component tests

- Categories:
  - desktop hover description behavior remains.
  - mobile variant has always-visible description.
  - arrow controls enable/disable with rail boundaries.
- Books CTA card renders and links to `/books`.
- ToC components:
  - current chapter highlighted.
  - drawer open/close behavior on mobile.

## 12.2 Hook tests

- `useBooksFeed`:
  - initial data hydration
  - load-more append and dedupe
  - error and retry

## 12.3 API route tests

- `pages/api/books.ts`:
  - method guard
  - param normalization
  - happy path payload shape
  - failure path

## 12.4 Page-level smoke checks

- `/` mobile and desktop rendering order.
- `/books` infinite scroll behavior.
- `/books/[slug]` detail + chapter links.
- `/books/[slug]/chapters/[chapterSlug]` content + ToC behavior.

## 13. Rollout Phases

## Phase A: Foundations

1. Validate runtime GraphQL contract for Books/Chapters against the live PayloadCMS backend.
2. Add types and API modules using the real backend field sets.
3. Add `/api/books` pagination route.

## Phase B: Homepage UX

1. Refactor categories into desktop + mobile variants.
2. Add mobile top rail and controls.
3. Add desktop Books CTA block in sidebar top.

## Phase C: Bookshelf

1. Build `/books` page with infinite grid.
2. Add loading, error, and empty states.

## Phase D: Book and Chapter detail

1. Build `/books/[slug]` page.
2. Build chapter route with Lexical-rendered content.
3. Build desktop ToC sidebar + mobile drawer.

## Phase E: Hardening

1. Add tests.
2. Verify responsive and accessibility behavior.
3. Tune UI copy and metadata.

## 14. Edge Cases and Notes

1. Book exists but chapter slug does not belong to that book:
   - return 404 instead of cross-book leakage.
2. Chapters with duplicate order values:
   - use secondary stable sort (createdAt/id) for deterministic ToC.
3. Missing cover image:
   - render fallback media placeholder style.
4. Empty Books collection:
   - show dedicated empty state with non-error tone.
5. Infinite scroll throttling:
   - prevent duplicate load calls when sentinel rapidly toggles.

## 15. Open Decisions Needed Before Build

1. Confirm final copy for Books CTA subtext.
2. Confirm chapter page ToC side preference on desktop (left vs right).
3. Confirm whether chapter pages should include previous/next controls in first release.

---

If this plan is approved, implementation can start from Phase A and proceed sequentially to reduce integration risk.