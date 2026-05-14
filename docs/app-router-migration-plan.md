# Pages Router To App Router Migration Plan

> Status: implementation-grade research and proposal
>
> Date: 2026-05-14
>
> Scope:
>
> - `/home/quanghuy1242/pjs/next-blog`
>
> Source docs:
>
> - Local source code under `pages/`, `components/`, `common/`, `hooks/`, `context/`, `tests/`, `next.config.mjs`, `open-next.config.ts`, `wrangler.jsonc`, and `.github/workflows/deploy-cloudflare.yml`
> - Next.js App Router migration guide: <https://nextjs.org/docs/app/guides/migrating/app-router-migration>
> - Next.js Route Handlers reference: <https://nextjs.org/docs/app/api-reference/file-conventions/route>
> - Next.js caching guide: <https://nextjs.org/docs/app/getting-started/caching>
> - Next.js caching without Cache Components guide: <https://nextjs.org/docs/app/guides/caching-without-cache-components>
> - Next.js `draftMode` reference: <https://nextjs.org/docs/app/api-reference/functions/draft-mode>
> - Next.js `cookies` reference: <https://nextjs.org/docs/app/api-reference/functions/cookies>
> - Next.js `generateMetadata` reference: <https://nextjs.org/docs/app/api-reference/functions/generate-metadata>
> - OpenNext Cloudflare docs: <https://opennext.js.org/cloudflare>
>
> Related docs:
>
> - `README.md`
> - `docs/phase2-reading-features-blog-integration.md`
> - `docs/route-prefetch.md`
> - `docs/cache-guide.md`
>
> Assumptions:
>
> - The code is the source of truth; existing docs may lag implementation.
> - The migration must preserve every current public route, auth route, API route, cookie contract, cache behavior, and user-facing flow before Pages Router code is removed.
> - Deployment remains Cloudflare Workers through `@opennextjs/cloudflare`, not Vercel.
> - No PayloadCMS, Auther, or database schema migration is in first-release scope unless a route contract forces a small adapter change.

## Table Of Contents

- [1. Goal](#1-goal)
- [2. Feasibility Summary](#2-feasibility-summary)
- [3. Current-State Findings](#3-current-state-findings)
  - [3.1 Runtime And Deployment](#31-runtime-and-deployment)
  - [3.2 Route Inventory](#32-route-inventory)
  - [3.3 Data And Cache Model](#33-data-and-cache-model)
  - [3.4 Auth, Draft, And Cookie Model](#34-auth-draft-and-cookie-model)
  - [3.5 Client State And Navigation Model](#35-client-state-and-navigation-model)
  - [3.6 Test Coverage](#36-test-coverage)
- [4. Target Model](#4-target-model)
- [5. Architecture Decisions](#5-architecture-decisions)
  - [5.1 Migrate Incrementally With Coexisting Routers](#51-migrate-incrementally-with-coexisting-routers)
  - [5.2 Split Server Data Loaders From Client Interactivity](#52-split-server-data-loaders-from-client-interactivity)
  - [5.3 Keep Route Handlers As The Browser Mutation Boundary](#53-keep-route-handlers-as-the-browser-mutation-boundary)
  - [5.4 Defer Cache Components Until After Parity](#54-defer-cache-components-until-after-parity)
  - [5.5 Replace Pages Data Warmup With App Router Prefetching](#55-replace-pages-data-warmup-with-app-router-prefetching)
- [6. Implementation Strategy](#6-implementation-strategy)
- [7. Detailed Implementation Plan](#7-detailed-implementation-plan)
  - [7.1 Foundation](#71-foundation)
  - [7.2 Route Handlers](#72-route-handlers)
  - [7.3 Public Static And ISR Routes](#73-public-static-and-isr-routes)
  - [7.4 Homepage](#74-homepage)
  - [7.5 Books And Reader Routes](#75-books-and-reader-routes)
  - [7.6 Auth And Signup Routes](#76-auth-and-signup-routes)
  - [7.7 Navigation, Analytics, And Scroll Restoration](#77-navigation-analytics-and-scroll-restoration)
  - [7.8 Tests And Tooling](#78-tests-and-tooling)
- [8. Migration And Rollout](#8-migration-and-rollout)
- [9. Edge Cases And Failure Modes](#9-edge-cases-and-failure-modes)
- [10. Implementation Backlog](#10-implementation-backlog)
- [11. Future Backlog](#11-future-backlog)
- [12. Test And Verification Plan](#12-test-and-verification-plan)
- [13. Definition Of Done](#13-definition-of-done)
- [14. Final Model](#14-final-model)

## 1. Goal

Move `next-blog` from Pages Router to App Router while keeping 100% functional parity:

- All public URLs continue to resolve.
- All OAuth, signup, logout, draft preview, comments, bookmarks, reading progress, chapter unlock, and infinite-scroll APIs keep the same browser-visible contracts.
- PayloadCMS GraphQL integration and Cloudflare cache behavior remain intact.
- App Router improvements are used where they reduce complexity or improve performance without changing behavior.

Non-goals for the first release:

- Replacing PayloadCMS GraphQL with REST or direct database access.
- Replacing Auther OAuth2 PKCE.
- Rebuilding the visual design.
- Removing the custom Cloudflare GraphQL cache before parity is proven.
- Enabling Cache Components as the first migration step.

## 2. Feasibility Summary

The migration is feasible and worth doing, but it is not a mechanical rename. The repo already runs modern dependencies (`next@16.2.4`, React 19, TypeScript 6, OpenNext Cloudflare 1.19) and does not need a framework-version upgrade first. The hard parts are architectural:

- The current app depends on Pages Router-only APIs: `getServerSideProps`, `getStaticProps`, `getStaticPaths`, `next/head`, `next/router`, `_app.tsx`, `_document.tsx`, and `NextApiRequest`/`NextApiResponse`.
- Several Pages Router pages are fully client-capable today because every component under `pages/` is effectively allowed to use hooks. App Router defaults to Server Components, so hook-heavy surfaces must be split into server loaders plus explicit client components.
- `common/utils/route-prefetch.ts` is explicitly coupled to `/_next/data/{buildId}.json` and Next Pages Router internals. It should be retired or rewritten, not carried forward unchanged.
- Authenticated book routes and reader routes read cookies and return user-specific data. These should remain dynamic routes at first. Their public content can be optimized later by isolating private UI behind Suspense or private cache scopes.
- The route handlers are straightforward to port because their current logic is already isolated in `common/apis/*` and `common/utils/*`; the main change is adapting request, response, cookies, redirects, and body parsing to Web APIs.

Recommendation: do a phased, route-by-route migration with both routers present until each route reaches parity. Next's migration guide explicitly supports moving data fetching into Server Components and updating routing hooks to `next/navigation`; it also documents that `app` and `pages` can be migrated incrementally. Route Handlers use standard Web `Request` and `Response` APIs, and OpenNext Cloudflare supports deploying Next apps to Cloudflare Workers with the Node.js runtime, which matches this app's existing `node:crypto`, `Buffer`, and server-side utility usage.

## 3. Current-State Findings

### 3.1 Runtime And Deployment

Observed files:

- `package.json`
- `next.config.mjs`
- `open-next.config.ts`
- `wrangler.jsonc`
- `.github/workflows/deploy-cloudflare.yml`

Current runtime facts:

- Framework versions are already current enough for an App Router migration: `next@16.2.4`, `react@19.2.5`, `react-dom@19.2.5`.
- Production build script is `next build --webpack`; Cloudflare deployment runs `opennextjs-cloudflare build` then Wrangler deploy.
- OpenNext Cloudflare is configured with R2 incremental cache and regional cache in `open-next.config.ts`.
- `wrangler.jsonc` deploys `.open-next/worker.js`, enables `nodejs_compat`, binds `NEXT_INC_CACHE_R2_BUCKET`, and configures a Durable Object queue.
- CI deploy uses Node 22, pnpm 10.33.2, and deploys directly on `master` push or manual workflow.
- `next.config.mjs` sets `reactCompiler: true`, unoptimized images, and `reactRemoveProperties`.

Migration implication:

- Keep the Node.js runtime. OpenNext Cloudflare's docs recommend the Next Node.js runtime for Cloudflare because it is more fully featured than Edge, and this repo uses Node APIs in auth, preview, and cookie code.
- Do not switch deployment adapters as part of the router migration.
- Keep `next build --webpack` until an App Router build passes under OpenNext; Turbopack migration is separate.

### 3.2 Route Inventory

Current UI routes:

| Current file | Route | Rendering today | Behavior to preserve |
| --- | --- | --- | --- |
| `pages/index.tsx` | `/` | SSR | Homepage, banner, categories, books CTA, category/tag query filters, context-restored infinite scroll through `/api/posts`. |
| `pages/posts/[slug].tsx` | `/posts/[slug]` | ISR with blocking fallback, `revalidate: 60` | Post detail, draft mode, metadata, Lexical content, comments, similar posts. |
| `pages/books/index.tsx` | `/books` | SSR | Public book grid, authenticated reading progress, bookmark state, infinite scroll, focus/visibility refresh. |
| `pages/books/[slug].tsx` | `/books/[id~slug]` and legacy `/books/[slug]` | SSR | Book detail, slug-only redirect to canonical `id~slug`, chapter list, book bookmark, reading progress, continue-reading link. |
| `pages/books/[slug]/chapters/[chapterSlug].tsx` | `/books/[id~slug]/chapters/[chapterSlug]` and legacy book segment | SSR | Chapter reader, slug-only redirect, TOC, drawer, password gate, comments, bookmark, reading progress, local scroll restoration. |
| `pages/categories.tsx` | `/categories` | ISR, `revalidate: 60` | Header and not-yet-implemented placeholder. |
| `pages/about.tsx` | `/about` | ISR, `revalidate: 3600` | Author bio, Lexical renderer, social metadata. |
| `pages/shelf.tsx` | `/shelf` | SSR | Auth-aware shelf for book and chapter bookmarks. |
| `pages/auth/login.tsx` | `/auth/login` | SSR redirect | Create PKCE state cookie and redirect to Auther authorize URL. |
| `pages/auth/callback.tsx` | `/auth/callback` | SSR redirect | Validate PKCE state, exchange code, set auth cookies, redirect to return target. |
| `pages/auth/logout.tsx` | `/auth/logout` | SSR redirect | Clear auth state and token cookies, redirect. |
| `pages/auth/signup.tsx` | `/auth/signup` | SSR redirect or fallback UI | Create signup intent and redirect to Auther signup URL; render unavailable panel on failure. |

Current API routes:

| Current file | Route | Methods | Behavior to preserve |
| --- | --- | --- | --- |
| `pages/api/posts.ts` | `/api/posts` | `GET` | Paginated posts with `limit`, `offset`, `category`, single `tag`, category short-circuit. |
| `pages/api/books.ts` | `/api/books` | `GET` | Paginated books, auth-aware cache choice, `Cache-Control: no-store` for authenticated responses. |
| `pages/api/comments/index.ts` | `/api/comments` | `GET`, `POST` | Exactly one of `chapterId` or `postId`, auth for create, max length validation, chapter proof forwarding. |
| `pages/api/comments/[commentId].ts` | `/api/comments/[commentId]` | `PATCH`, `DELETE` | Auth required, edit/delete comment, chapter proof forwarding. |
| `pages/api/bookmarks/index.ts` | `/api/bookmarks` | `GET`, `POST` | Anonymous GET returns empty result, auth POST required, content type validation. |
| `pages/api/bookmarks/[bookmarkId].ts` | `/api/bookmarks/[bookmarkId]` | `DELETE` | Auth required, delete bookmark. |
| `pages/api/reading-progress.ts` | `/api/reading-progress` | `POST` | Auth required, `chapterId`, `bookId`, `progress` validation. |
| `pages/api/chapters/unlock.ts` | `/api/chapters/unlock` | `POST` | Password unlock mutation to Payload, proof cookie update, `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| `pages/api/auth/session.ts` | `/api/auth/session` | any today, effectively `GET` | Return `{ isAuthenticated }`, no-store. |
| `pages/api/draft.ts` | `/api/draft` | `GET` | Validate preview token, enable draft mode, 307 redirect. |
| `pages/api/draft-exit.ts` | `/api/draft-exit` | `GET` | Disable draft mode, 307 redirect to `/`. |

Migration implication:

- UI and API routes can be migrated independently, but each path must exist in only one router at a time. Use route parity branches and delete the corresponding `pages/*` file when introducing the final `app/*` route.
- Auth and API routes are good early candidates because they have strong tests and limited UI coupling.

### 3.3 Data And Cache Model

Observed files:

- `common/apis/base.ts`
- `common/apis/cache.ts`
- `common/apis/index.ts`
- `common/apis/posts.ts`
- `common/apis/posts.slug.ts`
- `common/apis/books.ts`
- `common/apis/chapters.ts`
- `common/apis/comments.ts`
- `common/apis/bookmarks.ts`
- `common/apis/reading-progress.ts`
- `types/cms.ts`

Current behavior:

- All PayloadCMS data flows through GraphQL helpers in `common/apis/*`.
- `fetchAPI` posts to `${PAYLOAD_BASE_URL}/api/graphql`.
- Anonymous trusted requests use `Authorization: users API-Key ${PAYLOAD_API_KEY}` when `useApiKey` is true.
- Authenticated reader requests use `Authorization: Bearer <token>` via `fetchAPIWithAuthToken`.
- Cloudflare cache is custom, not Next Data Cache:
  - `ONE_HOUR_PAYLOAD_CACHE`: 1 hour fresh, 24 hours stale.
  - `AUTH_PAYLOAD_CACHE`: 1 hour fresh, 5 hours stale.
  - Cache key includes GraphQL query and variables; authenticated entries partition by unverified JWT `sub` and `exp`.
  - Background refresh uses `getCloudflareContext({ async: true })` and `ctx.waitUntil`.
  - Cache tags are written to `Cache-Tag` headers, but there is no observed route that invalidates by tag in this repo.
- `fetchAPI` already accepts a `next` option with `revalidate` and `tags`, but current callers primarily use the custom Cloudflare cache option.

Migration implication:

- Preserve `common/apis/*` as server-only data access modules in the first release.
- Keep `readThroughCloudflareCache` for Cloudflare parity. App Router caching can wrap or replace it later after production metrics prove parity.
- Server Components can call these helpers directly. Browser components should continue to call route handlers for pagination, comments, bookmarks, and reading progress.

### 3.4 Auth, Draft, And Cookie Model

Observed files:

- `common/utils/auth.ts`
- `common/utils/auth-cookies.ts`
- `common/utils/blog-auth.ts`
- `common/utils/blog-signup.ts`
- `common/utils/preview.ts`
- `common/utils/chapter-password-proof.ts`
- `pages/auth/*`
- `pages/api/draft.ts`
- `pages/api/draft-exit.ts`
- `pages/api/chapters/unlock.ts`

Current auth behavior:

- Token extraction checks `Authorization`, `betterAuthToken`, `payload-token`, then `better-auth.session_token`.
- `/auth/login` creates a PKCE state payload and stores `blogAuthState` for 10 minutes.
- `/auth/callback` validates state, exchanges `code` and verifier through Auther, and writes `betterAuthToken` plus `payload-token`.
- `/auth/logout` clears `blogAuthState`, `betterAuthToken`, and `payload-token`.
- Cookie domain defaults to a derived registrable domain from `x-forwarded-host` or `host`; `AUTH_SHARED_COOKIE_DOMAIN` overrides it.
- `/auth/signup` creates an Auther signup intent using `BLOG_SIGNUP_*` env vars and redirects to `/sign-up` on the Auther origin.
- Draft preview uses `PAYLOAD_PREVIEW_SECRET` signed tokens and Pages `res.setDraftMode`.
- Chapter unlock uses a custom `chapter-password-proof` cookie and forwards `x-chapter-password-proof` to Payload when appropriate.

Migration implication:

- Do not call existing `auth-cookies.ts` response helpers directly from App Route Handlers because they are typed around Node `ServerResponse`. Add Web-response equivalents or replace them with `NextResponse.cookies`.
- Server Components should read auth through a new helper that adapts `await cookies()` and `await headers()` into the existing `getBetterAuthTokenFromRequest` shape.
- Draft routes should move to `app/api/draft/route.ts` and `app/api/draft-exit/route.ts` using App Router `draftMode()` from `next/headers`.

### 3.5 Client State And Navigation Model

Observed files:

- `pages/_app.tsx`
- `pages/_document.tsx`
- `components/core/layout.tsx`
- `components/core/header.tsx`
- `context/state.tsx`
- `hooks/useHomePosts.ts`
- `hooks/useBooksFeed.ts`
- `hooks/useComments.ts`
- `hooks/useBookmark.ts`
- `hooks/useReadingProgress.ts`
- `components/shared/ssr-prefetch-link.tsx`
- `common/utils/route-prefetch.ts`

Current behavior:

- `_app.tsx` wraps all pages in `AppWrapper`, implements manual browser scroll restoration, and fires `gtag.pageview` on `routeChangeComplete`.
- `_document.tsx` injects Google Analytics script tags.
- `Header` is client-side, reads context header fallback, calls `/api/auth/session`, listens for route changes, focus, and visibility changes.
- `useHomePosts` keeps homepage posts in context so back navigation restores filtered infinite-scroll state.
- `useBooksFeed` refreshes authenticated book data on focus/visibility.
- `useReadingProgress` persists local scroll position in `localStorage`, sends progress to `/api/reading-progress`, uses `window.__historyScrollRestoredFor` to avoid fighting manual history restoration, and flushes on `pagehide`.
- `SSRPrefetchLink` disables built-in `next/link` prefetch and calls `common/utils/route-prefetch.ts`.
- `route-prefetch.ts` is Pages Router-specific: it reads `__NEXT_DATA__`, client page manifests, Next route matcher internals, and warms `/_next/data` requests.

Migration implication:

- Add `app/layout.tsx` and a client `components/app/app-providers.tsx` that contains `AppWrapper`, analytics, and scroll restoration.
- Replace `next/router` usage with `next/navigation` hooks in client components:
  - `usePathname()` and `useSearchParams()` for return URLs and query filters.
  - `useRouter().replace()` for chapter unlock refresh behavior.
  - No `router.events`; use pathname/search param effects for analytics and auth sync.
- Retire `common/utils/route-prefetch.ts` for App Router routes. The current implementation is intentionally coupled to Pages Router data URLs and will warm the wrong contract after migration.

### 3.6 Test Coverage

Observed files:

- `tests/api/*.test.ts`
- `tests/apis/*.test.ts`
- `tests/common/**/*.test.ts`
- `tests/components/*.test.tsx`
- `tests/hooks/*.test.tsx`
- `tests/pages/*.test.tsx`
- `vitest.config.ts`

Current coverage strengths:

- API route behavior is covered for posts, books, bookmarks, comments, chapter unlock, and auth session.
- Auth redirect flows are covered in `tests/pages/auth-routes.test.ts` and signup in `tests/pages/auth-signup.test.ts`.
- Book route parsing, preview token validation, chapter proof normalization, reading progress math, and route prefetch internals have utility tests.
- Components and hooks for books, posts, categories, comments, header, Lexical rendering, SSR prefetch, and reading progress have unit coverage.

Current test gaps for migration:

- Tests currently import Pages Router files and Next API handlers directly. Route Handlers will need tests that call `GET`, `POST`, `PATCH`, and `DELETE` exported functions with `Request` or `NextRequest`.
- There is no browser end-to-end test covering OAuth redirect stubs, chapter unlock, draft preview, or full reader progress.
- There is no App Router RSC test harness yet.

## 4. Target Model

Target route tree:

```text
app/
  layout.tsx
  providers.tsx
  page.tsx
  about/page.tsx
  categories/page.tsx
  posts/[slug]/page.tsx
  books/page.tsx
  books/[slug]/page.tsx
  books/[slug]/chapters/[chapterSlug]/page.tsx
  shelf/page.tsx
  auth/login/route.ts
  auth/callback/route.ts
  auth/logout/route.ts
  auth/signup/page.tsx
  api/auth/session/route.ts
  api/posts/route.ts
  api/books/route.ts
  api/comments/route.ts
  api/comments/[commentId]/route.ts
  api/bookmarks/route.ts
  api/bookmarks/[bookmarkId]/route.ts
  api/reading-progress/route.ts
  api/chapters/unlock/route.ts
  api/draft/route.ts
  api/draft-exit/route.ts
```

Target component ownership:

- Server Components:
  - Route `page.tsx` files fetch initial data.
  - Metadata is produced through `generateMetadata` or static `metadata`.
  - Redirect and 404 behavior uses `redirect()` and `notFound()`.
  - Cookie/header auth state is read through App Router request APIs.
- Client Components:
  - Homepage feed interactions.
  - Books feed interactions.
  - Header auth polling.
  - Comments, bookmarks, reading progress, chapter drawer, password gate callback, route analytics, and scroll restoration.
- Shared server libraries:
  - `common/apis/*` remain server data modules.
  - Add `server/request-context.ts` or similar for App Router cookie/header adapters.
- Shared route-handler utilities:
  - Add `server/http.ts` or `app/api/_utils.ts` for method guards, JSON parsing, no-store headers, and cookie serialization.

Target data flow:

```text
Server Component page
  -> reads cookies/searchParams/params/draftMode
  -> calls common/apis/*
  -> passes serializable props to client island
  -> renders shared presentational components

Client component
  -> calls app/api route handlers for mutation and incremental pagination
  -> route handler validates method/body/auth
  -> calls common/apis/*
  -> returns same JSON shape used today
```

## 5. Architecture Decisions

### 5.1 Migrate Incrementally With Coexisting Routers

Decision: migrate one route family at a time and delete the corresponding `pages/*` file only when the `app/*` implementation is ready.

Why:

- Next's official migration guide is built around creating `app/`, adding a root layout, moving pages one by one, moving data fetching into Server Components, and updating routing hooks.
- The app has high-value behavior with good existing tests; route families can be validated independently.

Rejected option: big-bang migration of all pages and APIs in one PR.

Reason rejected:

- Too many simultaneous risks: route conflicts, auth cookies, draft mode, comments, reader progress, route warmup, and OpenNext runtime behavior.

### 5.2 Split Server Data Loaders From Client Interactivity

Decision: each migrated page gets a small Server Component route plus a client component only where hooks or browser APIs are required.

Why:

- App Router defaults to Server Components.
- Current pages mix data loading, metadata, and hook-heavy UI in one file.
- This split reduces client JavaScript for static content like post body, about page, categories placeholder, and book/chapter lists.

Rejected option: mark every migrated page with `'use client'`.

Reason rejected:

- It preserves behavior quickly but loses the main App Router benefits and forces server data through client fetches.

### 5.3 Keep Route Handlers As The Browser Mutation Boundary

Decision: convert existing API routes to App Route Handlers before considering Server Actions.

Why:

- Current hooks already depend on stable browser endpoints.
- External clients or tests may call the current `/api/*` endpoints.
- Route Handlers preserve the same REST-like contracts and use standard Web APIs.

Rejected option: convert comments, bookmarks, and reading progress directly to Server Actions during first release.

Reason rejected:

- It would change client contracts and complicate parity verification. Server Actions can be evaluated later for form-like actions after route parity.

### 5.4 Defer Cache Components Until After Parity

Decision: use the existing Cloudflare cache plus conservative App Router segment config in the first release. Do not enable `cacheComponents: true` yet.

Why:

- Next 16 Cache Components are current, but enabling them changes rendering and caching semantics across the app.
- The current cache implementation has Cloudflare-specific SWR and `ctx.waitUntil` behavior.
- Several routes are auth-sensitive and cookie-sensitive; a cache semantics change before parity is unnecessary risk.

First-release cache posture:

- `about` and `categories`: route-level `revalidate` matching current ISR.
- `posts/[slug]`: `revalidate = 60` for non-draft content, with draft mode forcing dynamic behavior.
- `books`, `book detail`, `chapter reader`, `shelf`: dynamic because they read auth/proof cookies.
- API route handlers: preserve `Cache-Control: no-store, max-age=0` where currently set.

Future option:

- After parity, evaluate Cache Components, `cacheLife`, and `cacheTag` for public content while keeping private reader state isolated.

### 5.5 Replace Pages Data Warmup With App Router Prefetching

Decision: remove Pages-specific `/_next/data` warmup for migrated App Router routes and replace `SSRPrefetchLink` with a wrapper around App Router-compatible `next/link` prefetching.

Why:

- `common/utils/route-prefetch.ts` states it targets Pages Router data loading.
- App Router navigation does not use the same `/_next/data` JSON contract.
- Keeping the old scheduler would add network noise and fragile Next internals.

First-release behavior:

- Implement `AppPrefetchLink` or simplify `SSRPrefetchLink` so it uses `next/link` with default or explicit `prefetch`.
- Keep the `ssrPrefetch` prop temporarily as a no-op compatibility prop on shared buttons and links to avoid broad UI churn.
- Delete `route-prefetch.ts` and its tests only when no Pages route depends on it.

## 6. Implementation Strategy

Sequence:

1. Add App Router foundation while Pages Router still runs.
2. Add adapter utilities for App Router request cookies, response cookies, redirects, no-store JSON, and route params.
3. Port `/api/*` route handlers with tests.
4. Port auth redirect routes.
5. Port simple public pages (`/about`, `/categories`, `/posts/[slug]`).
6. Port homepage and its query/filter behavior.
7. Port book and chapter routes.
8. Port shelf.
9. Replace navigation, analytics, scroll restoration, and prefetch behavior.
10. Remove remaining `pages/` files, Pages Router tests, Pages Router-only dependencies, and obsolete warmup utilities.

Compatibility bridge:

- Keep `common/apis/*`, `common/utils/*`, `hooks/*`, and presentational components in place during migration.
- Create client wrappers instead of rewriting shared components immediately.
- Keep `/api/*` JSON response shapes unchanged so hooks can be migrated independently from server routes.

Rollback:

- Before deleting a `pages/*` route, keep the old file available on the branch until the new route passes tests.
- If a migrated route fails in production, revert that route-family commit and restore its `pages/*` file.
- Avoid schema or external service changes in the first release so rollback is code-only.

## 7. Detailed Implementation Plan

### 7.1 Foundation

Current problem:

- `_app.tsx` and `_document.tsx` own global styles, context, analytics script injection, pageview tracking, and manual scroll restoration.
- App Router needs root `app/layout.tsx`, metadata/script APIs, and explicit client providers.

Target behavior:

- `app/layout.tsx` imports `styles/index.css`, sets `<html lang="en">`, renders GA script through `next/script`, and wraps children in a client provider.
- A client provider preserves `AppWrapper`, pageview tracking, and manual scroll restoration.

Implementation tasks:

- [ ] Create `app/layout.tsx`.
- [ ] Create `app/providers.tsx` with `'use client'`.
- [ ] Move the `_app.tsx` scroll restoration logic into a client component that uses `usePathname()` and `useSearchParams()` instead of `router.events`.
- [ ] Move GA script injection from `_document.tsx` to `next/script` in `app/layout.tsx`.
- [ ] Keep `context/state.tsx` as a client-only provider.
- [ ] Mark hook-using components with `'use client'` where needed:
  - `components/core/header.tsx`
  - `components/shared/ssr-prefetch-link.tsx` or replacement
  - `components/shared/bookmark-button.tsx`
  - `components/shared/comments/CommentsSection.tsx`
  - hook-driven page clients for homepage, books, and chapter reader

Tests:

- Add `tests/app/providers.test.tsx` or component tests for analytics and scroll restoration if logic is extractable.
- Update `tests/components/header.test.tsx` to mock `next/navigation` instead of `next/router`.

### 7.2 Route Handlers

Current problem:

- API routes use `NextApiRequest`, `NextApiResponse`, `req.query`, `req.body`, `req.cookies`, `res.status`, `res.setHeader`, and `res.setDraftMode`.

Target behavior:

- App Route Handlers export method-named functions and return `Response` or `NextResponse`.
- JSON shapes, status codes, `Allow`, `Cache-Control`, and `Set-Cookie` behavior match current API routes.

Implementation tasks:

- [ ] Add `app/api/_utils/http.ts`:
  - `json(data, init?)`
  - `methodNotAllowed(methods)`
  - `noStoreHeaders()`
  - `parseJsonBody(request)`
  - `getSearchParam(request.nextUrl, key)`
  - `getAuthTokenFromNextRequest(request)`
  - `getChapterProofFromNextRequest(request)`
- [ ] Port `/api/posts` to `app/api/posts/route.ts`.
- [ ] Port `/api/books` to `app/api/books/route.ts`.
- [ ] Port `/api/comments` and `/api/comments/[commentId]`.
- [ ] Port `/api/bookmarks` and `/api/bookmarks/[bookmarkId]`.
- [ ] Port `/api/reading-progress`.
- [ ] Port `/api/chapters/unlock`.
- [ ] Port `/api/auth/session`.
- [ ] Port `/api/draft` and `/api/draft-exit` using `draftMode()`.

Tests:

- Convert API tests to import route method exports and call them with `NextRequest` or `Request`.
- Preserve assertions for status, JSON body, `Allow`, `Cache-Control`, and `Set-Cookie`.

### 7.3 Public Static And ISR Routes

Current problem:

- `/about`, `/categories`, and `/posts/[slug]` use `getStaticProps`, `getStaticPaths`, `Head`, and `next/error`.

Target behavior:

- App pages fetch data directly in Server Components.
- Metadata is exported through `generateMetadata`.
- 404s use `notFound()`.
- Draft mode uses `await draftMode()`.

Implementation tasks:

- [ ] Create `app/about/page.tsx`:
  - `export const revalidate = 3600`.
  - Call `getDataForAbout()`.
  - Use `generateMetadata` with `generateMetaTags` logic translated to Next metadata shape.
- [ ] Create `app/categories/page.tsx`:
  - `export const revalidate = 60`.
  - Call `getDataForHome()`.
  - Preserve `NotYetImplemented`.
- [ ] Create `app/posts/[slug]/page.tsx`:
  - Do not generate static params initially; preserve blocking-on-first-request behavior.
  - Call `getDataForPostSlug(slug, { draftMode: isEnabled })`.
  - Use `notFound()` when no post.
  - Use `export const revalidate = 60` for normal content.
  - Keep `CommentsSection` as a client component.
- [ ] Create metadata helpers that return Next `Metadata` instead of React `<Head>` meta tag elements.

Tests:

- Add page tests for `notFound` behavior by testing loader functions or extracted server data functions.
- Keep `tests/components/lexical-renderer.test.tsx`.
- Add metadata helper unit tests for generated title, description, Open Graph image, and article type.

### 7.4 Homepage

Current problem:

- `pages/index.tsx` mixes SSR data fetching, query parsing, `useRouter`, context-restored infinite scroll, and metadata.

Target behavior:

- `app/page.tsx` is a Server Component that receives `searchParams`, fetches the initial filtered posts, and renders a client `HomePageClient`.
- `HomePageClient` owns `useHomePosts`, intersection observer, retry UI, and context synchronization.

Implementation tasks:

- [ ] Create `app/page.tsx`.
- [ ] Create `components/pages/index/home-page-client.tsx` with `'use client'`.
- [ ] Replace `router.query` and `router.isReady` with server-normalized `initialCategory` and `initialTags`; if client-side filter changes are still needed, use `useSearchParams()`.
- [ ] Keep `POSTS_PAGE_SIZE = 5`.
- [ ] Keep `/api/posts` contract for load more and filtered reload.
- [ ] Preserve category invalidation behavior: unknown category returns empty posts and `initialHasMore: false`.
- [ ] Convert homepage metadata from `<Head>{renderMetaTags(metaTags)}</Head>` to `generateMetadata`.

Tests:

- Update `tests/hooks/useHomePosts.test.tsx` only if API contract changes; first release should not change it.
- Add a route loader test for search param parsing and invalid category behavior.

### 7.5 Books And Reader Routes

Current problem:

- Books and chapters are SSR because they depend on auth cookies, chapter proof cookies, draft mode, redirects, and user-specific reading state.
- Chapter reader uses `useRouter().replace(router.asPath)` after password unlock.

Target behavior:

- Keep these routes dynamic initially.
- Server pages read cookies and draft mode, fetch initial content, and pass serializable props into client islands for interactive reader behavior.

Implementation tasks:

- [ ] Add `server/app-request.ts`:
  - `getAuthTokenFromAppRequest()`
  - `getChapterProofFromAppRequest()`
  - adapter object compatible with `getBetterAuthTokenFromRequest`.
- [ ] Create `app/books/page.tsx`:
  - Read auth token from cookies.
  - Call `getDataForBooksPage(6, { authToken, cache })`.
  - Fetch initial bookmarks if authenticated.
  - Render `BooksPageClient`.
- [ ] Create `app/books/[slug]/page.tsx`:
  - Parse route segment with `parseBookRouteSegment`.
  - If legacy slug-only, call `getBookBySlug` and `redirect(buildBookHref(...))`.
  - If canonical `id~slug`, call `getBookDetailById`.
  - Preserve reading progress, initial bookmark, continue-reading selection, draft mode, and `notFound` conditions.
- [ ] Create `app/books/[slug]/chapters/[chapterSlug]/page.tsx`:
  - Preserve canonical redirect behavior.
  - Preserve `chapterPasswordProof` logic for anonymous non-draft users.
  - Preserve auth/proof cache selection.
  - Fetch reading progress and chapter bookmark for authenticated users.
  - Render `ChapterReaderClient`.
- [ ] Convert chapter unlock flow to use `useRouter` from `next/navigation` and refresh/replace the current URL after unlock.
- [ ] Keep `useReadingProgress` client-side and preserve `window.__historyScrollRestoredFor` behavior until scroll restoration is replaced.

Tests:

- Update `tests/pages/chapter-page.test.tsx` to render the extracted `ChapterReaderClient`.
- Add server loader tests for canonical redirect, notFound, locked chapter, authenticated progress, and bookmark initialization.
- Keep `tests/utils/book-route.test.ts` unchanged.

### 7.6 Auth And Signup Routes

Current problem:

- Auth routes are SSR pages whose component returns `null`, except signup fallback UI.
- Cookie helpers depend on Node `ServerResponse`.

Target behavior:

- Redirect-only auth routes become route handlers:
  - `app/auth/login/route.ts`
  - `app/auth/callback/route.ts`
  - `app/auth/logout/route.ts`
- Signup can be either a route handler plus fallback page or a dynamic page. Prefer a page for preserving the fallback UI.

Implementation tasks:

- [ ] Add `common/utils/app-auth-cookies.ts` or route-handler cookie helpers using `NextResponse`.
- [ ] Port `/auth/login`:
  - Normalize `returnTo`.
  - Set `blogAuthState`.
  - Redirect to `buildAuthorizeUrl(authState)`.
- [ ] Port `/auth/callback`:
  - Read `code` and `state` from `request.nextUrl.searchParams`.
  - Read `blogAuthState` from `request.cookies`.
  - Set auth token cookies with shared domain behavior.
  - Clear state cookie on all exit paths.
- [ ] Port `/auth/logout`:
  - Clear all auth cookies.
  - Preserve `returnTo` and post-logout destination behavior.
- [ ] Port `/auth/signup`:
  - Create signup intent server-side.
  - Redirect on success.
  - Render unavailable UI on failure.

Tests:

- Rewrite `tests/pages/auth-routes.test.ts` around `GET` route handler exports.
- Keep assertions for authorize URL params, cookie names, PKCE state, token cookie names, and return redirects.
- Rewrite `tests/pages/auth-signup.test.ts` around the chosen route/page split.

### 7.7 Navigation, Analytics, And Scroll Restoration

Current problem:

- `Header` and `_app.tsx` depend on `next/router` events.
- `SSRPrefetchLink` and `route-prefetch.ts` depend on Pages Router internals and `/_next/data`.

Target behavior:

- Navigation uses App Router hooks.
- Pageview analytics fires on pathname/search changes.
- Scroll restoration does not fight reader progress restoration.
- Prefetch uses App Router-compatible `next/link`.

Implementation tasks:

- [ ] Refactor `Header`:
  - Replace `useRouter` with `usePathname()` and `useSearchParams()`.
  - Replace `router.events.on('routeChangeComplete')` with an effect keyed by current URL.
- [ ] Add `components/app/analytics.tsx`:
  - Client component that calls `gtag.pageview(url)` on URL changes.
- [ ] Add `components/app/scroll-restoration.tsx`:
  - Port current scroll map logic using URL changes and `popstate` where possible.
  - Preserve `window.__historyScrollRestoredFor` semantics for `useReadingProgress`.
- [ ] Replace `SSRPrefetchLink` implementation:
  - Keep component name and `ssrPrefetch` callers for compatibility.
  - Remove `route-prefetch` scheduler calls for App Router routes.
  - Use standard `Link` prefetch behavior unless a route-specific performance issue appears.
- [ ] Delete `common/utils/route-prefetch.ts` after all callers are migrated away from Pages Router and tests are replaced.

Tests:

- Update `tests/components/header.test.tsx`.
- Replace `tests/components/ssr-prefetch-link.test.tsx` with tests that assert link rendering, click passthrough, and no legacy warmup calls.
- Delete or archive `tests/common/utils/route-prefetch.test.ts` when the scheduler is removed.

### 7.8 Tests And Tooling

Current problem:

- Current tests target Pages Router files and API handler signatures.
- There is no E2E parity suite.

Target behavior:

- Unit tests target shared logic and client components.
- Route Handler tests target exported Web handlers.
- A small E2E suite covers high-risk browser flows.

Implementation tasks:

- [ ] Add test helpers for `NextRequest` construction.
- [ ] Add test helpers for asserting `Response` JSON, status, headers, and cookies.
- [ ] Migrate direct imports from `pages/*` to extracted client components or route loaders.
- [ ] Add Playwright or equivalent E2E smoke tests:
  - Homepage renders and loads more posts.
  - Post detail renders comments section.
  - Login route redirects to Auther URL with PKCE params.
  - Books page renders anonymous and authenticated variants with stub cookies.
  - Chapter locked state unlocks and refreshes.
  - Reading progress sends `/api/reading-progress`.

Verification commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec opennextjs-cloudflare build
```

## 8. Migration And Rollout

Recommended PR sequence:

1. Foundation PR:
   - Add `app/layout.tsx`, providers, request adapters, response helpers, and metadata helpers.
   - No route takeover yet.
2. API route-handler PR:
   - Port `/api/*` endpoints and tests.
   - Delete corresponding `pages/api/*` files route by route.
3. Auth route PR:
   - Port `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/signup`.
   - Validate cookie domain behavior in local and deployed environments.
4. Static/public content PR:
   - Port `/about`, `/categories`, `/posts/[slug]`.
   - Validate metadata and draft preview.
5. Homepage PR:
   - Port `/`, preserve filters and infinite scroll.
6. Books PR:
   - Port `/books`, `/books/[slug]`, `/shelf`.
7. Chapter reader PR:
   - Port chapter route, password unlock, reader progress, TOC, comments, and canonical redirects.
8. Cleanup PR:
   - Remove `pages/`, `_app.tsx`, `_document.tsx`, `next/head`, `next/router`, Pages API types, route-prefetch scheduler, and obsolete tests.

Deployment rollout:

- Deploy to a preview Cloudflare route first if available.
- Smoke test anonymous pages.
- Smoke test authenticated browser flow with real Auther and Payload staging credentials.
- Only then deploy to `blog.quanghuy.dev`.

Rollback:

- Each PR should keep rollback at the route-family level.
- Avoid mixing route migration with visual refactors.
- Avoid enabling new cache systems or Turbopack in the same release.

## 9. Edge Cases And Failure Modes

- Route collision: if `pages/foo.tsx` and `app/foo/page.tsx` coexist for the same URL, builds or routing can fail. Delete old route files in the same commit that introduces the final App route.
- Cookie domain drift: Web cookie helpers must preserve `AUTH_SHARED_COOKIE_DOMAIN` and derived domain behavior from `auth-cookies.ts`.
- Auth cache leakage: never cache authenticated GraphQL responses without the existing auth subject partitioning or an equivalent private cache boundary.
- Draft leakage: draft mode must disable public cache use and include draft content only when `draftMode().isEnabled` is true.
- Locked chapter leakage: anonymous chapter requests with proof cookies must include the proof in the cache key and `x-chapter-password-proof` header exactly as today.
- Legacy book URLs: slug-only `/books/[slug]` and chapter paths must continue to redirect to `id~slug` canonical paths.
- Reader scroll fighting: App Router scroll behavior can conflict with `useReadingProgress`; preserve the `__historyScrollRestoredFor` handoff until tested.
- Route prefetch regression: deleting the custom warmup may change perceived speed on books and chapters. Measure before rebuilding custom speculation.
- API body parsing: Route Handlers can consume request bodies only once. Shared parse helpers should return clear 400s for invalid JSON.
- `Buffer` and `node:crypto`: keep Node runtime under OpenNext Cloudflare; do not move these handlers to Edge.
- Metadata parity: existing `renderMetaTags` output includes Open Graph and Twitter fields. New `generateMetadata` helpers must preserve title, description, image, and article type.
- Test blind spot: route handlers can pass unit tests but fail in OpenNext if runtime APIs differ. Run `opennextjs-cloudflare build` before merging route-family PRs.

## 10. Implementation Backlog

### R1-A. App Foundation

Scope:

- `app/layout.tsx`
- `app/providers.tsx`
- `components/app/analytics.tsx`
- `components/app/scroll-restoration.tsx`
- `components/core/header.tsx`

Tasks:

- [ ] Add App Router root layout and provider wrapper.
- [ ] Move global CSS import to `app/layout.tsx`.
- [ ] Move GA scripts to `next/script`.
- [ ] Replace router event analytics with pathname/search-param tracking.
- [ ] Replace Header `next/router` usage with `next/navigation`.

Acceptance criteria:

- App Router can render a temporary test page with the same header and context defaults.
- No existing Pages route behavior changes before route takeover.

Tests:

- `pnpm lint`
- `pnpm test -- tests/components/header.test.tsx`

### R1-B. App Request And Response Adapters

Scope:

- `server/app-request.ts`
- `app/api/_utils/http.ts`
- `common/utils/app-auth-cookies.ts`

Tasks:

- [ ] Add helpers to adapt `cookies()` and `headers()` to current auth utilities.
- [ ] Add `NextResponse` cookie helpers preserving existing cookie names, max age, domain, path, SameSite, HttpOnly, and Secure behavior.
- [ ] Add route-handler JSON, no-store, method guard, and body parsing helpers.

Acceptance criteria:

- Auth and chapter proof values can be read from App Router pages and Route Handlers.
- Cookie serialization matches existing tests.

Tests:

- `pnpm test -- tests/utils/auth-cookies.test.ts tests/utils/auth.test.ts tests/utils/chapter-password-proof.test.ts`

### R1-C. API Route Handler Migration

Scope:

- `app/api/**/*/route.ts`
- `pages/api/**` deletion as each route migrates
- `tests/api/*.test.ts`

Tasks:

- [ ] Port all current API routes to Route Handlers.
- [ ] Preserve JSON response shapes and status codes.
- [ ] Preserve no-store headers.
- [ ] Preserve chapter proof and auth token forwarding.
- [ ] Rewrite API tests around Web `Request`/`Response`.

Acceptance criteria:

- Existing hooks can call the same `/api/*` URLs without changes.
- All API tests pass after Pages API files are removed.

Tests:

- `pnpm test -- tests/api`
- `pnpm lint`

### R1-D. Auth Route Migration

Scope:

- `app/auth/login/route.ts`
- `app/auth/callback/route.ts`
- `app/auth/logout/route.ts`
- `app/auth/signup/page.tsx`
- `pages/auth/**` deletion
- `tests/pages/auth-routes.test.ts`
- `tests/pages/auth-signup.test.ts`

Tasks:

- [ ] Port login, callback, logout, and signup.
- [ ] Preserve PKCE state, token exchange, signup intent, and fallback UI.
- [ ] Preserve safe `returnTo` normalization.

Acceptance criteria:

- Login redirects to Auther authorize URL with the same params.
- Callback sets `betterAuthToken` and `payload-token`.
- Logout clears auth cookies.
- Signup redirects or renders unavailable state as today.

Tests:

- `pnpm test -- tests/pages/auth-routes.test.ts tests/pages/auth-signup.test.ts tests/utils/blog-signup.test.ts`

### R1-E. Public Content Routes

Scope:

- `app/about/page.tsx`
- `app/categories/page.tsx`
- `app/posts/[slug]/page.tsx`
- metadata helpers
- `pages/about.tsx`, `pages/categories.tsx`, `pages/posts/[slug].tsx` deletion

Tasks:

- [ ] Port static/ISR pages to Server Components.
- [ ] Convert meta tag generation to `Metadata`.
- [ ] Preserve draft mode for posts.
- [ ] Preserve post comments client island.

Acceptance criteria:

- `/about`, `/categories`, and `/posts/[slug]` render equivalent content and metadata.
- Missing post renders 404.
- Draft preview still sees draft posts.

Tests:

- `pnpm test -- tests/components/lexical-renderer.test.tsx tests/components/posts.test.tsx tests/api/comments.test.ts`
- Manual smoke for draft URL.

### R1-F. Homepage Migration

Scope:

- `app/page.tsx`
- `components/pages/index/home-page-client.tsx`
- `pages/index.tsx` deletion

Tasks:

- [ ] Move initial home data fetch to Server Component.
- [ ] Move interactive feed to client component.
- [ ] Preserve query filter parsing.
- [ ] Preserve context-restored infinite scroll.

Acceptance criteria:

- `/`, `/?category=...`, and `/?tag=...` first render matching filtered content.
- Infinite scroll still uses `/api/posts`.
- Empty invalid category behavior is preserved.

Tests:

- `pnpm test -- tests/hooks/useHomePosts.test.tsx tests/components/banner.test.tsx tests/components/categories.test.tsx tests/components/posts.test.tsx`

### R1-G. Books, Shelf, And Reader Migration

Scope:

- `app/books/page.tsx`
- `app/books/[slug]/page.tsx`
- `app/books/[slug]/chapters/[chapterSlug]/page.tsx`
- `app/shelf/page.tsx`
- extracted client components
- corresponding `pages/books/**` and `pages/shelf.tsx` deletion

Tasks:

- [ ] Port `/books` with auth-aware initial state.
- [ ] Port book detail canonical and legacy routing.
- [ ] Port chapter reader canonical and legacy routing.
- [ ] Preserve locked chapter gate and proof handling.
- [ ] Preserve bookmark and progress initialization.
- [ ] Port shelf.

Acceptance criteria:

- Anonymous and authenticated book routes render correctly.
- Canonical redirects are preserved.
- Locked chapters do not render protected content without proof.
- Reading progress and bookmarks continue to update through APIs.

Tests:

- `pnpm test -- tests/hooks/useBooksFeed.test.tsx tests/hooks/useReadingProgress.test.tsx tests/pages/chapter-page.test.tsx tests/components/chapter-toc.test.tsx tests/components/chapter-password-gate.test.tsx tests/api/bookmarks.test.ts`

### R1-H. Navigation Prefetch Cleanup

Scope:

- `components/shared/ssr-prefetch-link.tsx`
- `common/utils/route-prefetch.ts`
- `tests/components/ssr-prefetch-link.test.tsx`
- `tests/common/utils/route-prefetch.test.ts`

Tasks:

- [ ] Replace Pages data warmup with App Router-compatible link behavior.
- [ ] Preserve public props used by `ButtonLink`, `TextLink`, book cards, TOC, Lexical renderer, and categories.
- [ ] Remove `route-prefetch.ts` when no longer used.

Acceptance criteria:

- All link components render and navigate correctly.
- No code imports `next/dist/shared/lib/router/*` or `/_next/data` warmup logic.

Tests:

- `pnpm test -- tests/components/ssr-prefetch-link.test.tsx`
- `rg -n "route-prefetch|_next/data|next/dist/shared/lib/router" common components hooks pages app tests`

### R1-I. Final Cleanup

Scope:

- `pages/`
- Pages-router imports across repo
- tests
- docs

Tasks:

- [ ] Remove `pages/_app.tsx`, `pages/_document.tsx`, and remaining `pages/` files.
- [ ] Remove `next/head`, `next/router`, `next/app`, `next/document`, `GetServerSideProps`, `GetStaticProps`, `GetStaticPaths`, `NextApiRequest`, and `NextApiResponse` imports from production code.
- [ ] Update README route architecture if desired after migration.
- [ ] Run full verification suite and OpenNext build.

Acceptance criteria:

- `rg` finds no Pages Router-only production imports.
- Full build and tests pass.

Tests:

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm exec opennextjs-cloudflare build`

## 11. Future Backlog

- Evaluate Next 16 Cache Components after parity:
  - Introduce `cacheComponents: true` only in a separate PR.
  - Move public CMS reads into `use cache` functions with `cacheLife` and `cacheTag`.
  - Keep authenticated and proof-scoped content private.
- Add on-demand revalidation endpoints if Payload can call webhooks after content changes.
- Replace client comment/bookmark fetches with Server Actions only if it improves UX without breaking API consumers.
- Add Playwright E2E tests for real browser scroll restoration and reader progress.
- Consider Partial Prerendering only after OpenNext Cloudflare behavior is validated for this app's dynamic holes.
- Revisit `next build --webpack` and Turbopack after the router migration is stable.
- Add typed routes after all paths live in `app/`.

## 12. Test And Verification Plan

Automated verification:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec opennextjs-cloudflare build
```

Focused checks:

- API route handlers:
  - `tests/api/posts.test.ts`
  - `tests/api/books.test.ts`
  - `tests/api/bookmarks.test.ts`
  - `tests/api/comments.test.ts`
  - `tests/api/chapter-unlock.test.ts`
  - `tests/api/auth-session.test.ts`
- Auth:
  - `tests/pages/auth-routes.test.ts`
  - `tests/pages/auth-signup.test.ts`
  - `tests/utils/blog-signup.test.ts`
  - `tests/utils/auth-cookies.test.ts`
- Books and reader:
  - `tests/hooks/useBooksFeed.test.tsx`
  - `tests/hooks/useReadingProgress.test.tsx`
  - `tests/pages/chapter-page.test.tsx`
  - `tests/common/apis/chapters.test.ts`
  - `tests/utils/book-route.test.ts`
- Homepage:
  - `tests/hooks/useHomePosts.test.tsx`
  - `tests/api/posts.test.ts`
  - `tests/components/posts.test.tsx`
- Shared rendering:
  - `tests/components/lexical-renderer.test.tsx`
  - `tests/common/epub-link-resolver.test.ts`
  - `tests/components/ssr-prefetch-link.test.tsx`

Manual smoke:

- `/` with no query, `?category=...`, and `?tag=...`.
- `/posts/{slug}` published and draft preview.
- `/about`.
- `/books` anonymous and authenticated.
- `/books/{id~slug}` plus legacy `/books/{slug}` redirect.
- `/books/{id~slug}/chapters/{chapterSlug}` public, locked, and authenticated.
- Bookmark add/remove on book and chapter.
- Comment list/create/reply/edit/delete for post and chapter.
- Reading progress updates after scrolling and persists after reload.
- `/shelf` anonymous and authenticated.
- `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/signup` with real or stubbed Auther.
- Cloudflare preview deploy under OpenNext.

## 13. Definition Of Done

- All current routes and API endpoints exist under `app/`.
- No production code remains in `pages/`.
- No production imports remain from `next/router`, `next/head`, `next/app`, `next/document`, or Next API route types.
- Auth cookies, signup intent, draft mode, chapter proof cookies, bookmarks, comments, reading progress, and pagination keep their existing browser-visible contracts.
- Metadata parity is verified for home, posts, books, chapters, about, and categories.
- Full test suite passes.
- `pnpm build` passes.
- `pnpm exec opennextjs-cloudflare build` passes.
- Cloudflare preview smoke passes before production deployment.
- Old Pages Router route warmup code is removed or proven unused.

## 14. Final Model

The target system is an App Router blog deployed on Cloudflare Workers through OpenNext. Server Components own initial PayloadCMS reads and metadata. Client components own the interactive feed, reader, comments, bookmarks, auth polling, analytics, and scroll behavior. Route Handlers keep the current `/api/*` and `/auth/*` browser contracts stable. The existing Cloudflare GraphQL cache remains in place for first-release parity, with Cache Components and on-demand revalidation reserved for a later performance-focused pass.
