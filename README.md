# Next Blog

Personal blog frontend powered by **Next.js (Pages Router)**, consuming content from a **PayloadCMS GraphQL API** and authenticating via **Auther** (OAuth2 PKCE). Deployed on **Cloudflare Workers** with a custom speculative route warmup system. Live at <https://blog.quanghuy.dev/>.

---

## Architecture

```
                         ┌──────────────┐
          OAuth2 PKCE     │    Auther     │
     ┌───────────────────►│    (IdP)      │
     │                    └──────────────┘
     │ access_token              │
     │                           │ JWKS verification
┌────┴─────────┐         ┌──────▼──────┐
│  next-blog    │────────►│  payloadcms  │
│  (OAuth       │ Bearer  │  (resource   │
│   client)     │◄────────│   server)    │
└───────────────┘ GraphQL └─────────────┘
     │
     │  ISR cache
┌────▼──────────┐
│  Cloudflare    │
│  R2 + Workers  │
└───────────────┘
```

The blog is an **OAuth2 PKCE public client**. It delegates all authentication to Auther, stores the resource access token in shared-domain cookies, and forwards it as a Bearer token to PayloadCMS for content authorization.

---

## 1. OAuth2 PKCE Authentication

### Login Flow

1. User clicks "Sign in" → server creates PKCE state (`code_verifier` + `state` UUID), stores in `blogAuthState` cookie (10-min TTL)
2. Redirected to Auther's `/api/auth/oauth2/authorize` with `code_challenge` (SHA-256), `code_challenge_method=S256`, scope, and `theme=blog`
3. After authentication and consent → Auther redirects back to `/auth/callback?code=...&state=...`
4. Server validates state cookie, exchanges `code` + `verifier` for `access_token` via Auther's token endpoint
5. Sets **two** shared-domain cookies: `betterAuthToken` and `payload-token` (for PayloadCMS compatibility)
6. All GraphQL requests to PayloadCMS include `Authorization: Bearer <token>`

### Logout

Clears all three auth cookies (`blogAuthState`, `betterAuthToken`, `payload-token`). Redirects to homepage or configured `BLOG_POST_LOGOUT_REDIRECT_URI`.

### Cookie Strategy

| Cookie | Purpose | Domain |
|--------|---------|--------|
| `blogAuthState` | PKCE verifier + state + returnTo (10-min TTL) | Request host |
| `betterAuthToken` | Resource access token (2-day max) | Shared domain |
| `payload-token` | Duplicate for PayloadCMS compatibility | Shared domain |

Shared domain is derived from `x-forwarded-host` or `AUTH_SHARED_COOKIE_DOMAIN` env var. All cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

**Source:** `common/utils/blog-auth.ts`, `common/utils/auth-cookies.ts`, `pages/auth/callback.tsx`, `pages/auth/login.tsx`, `pages/auth/logout.tsx`

---

## 2. Route Warmup System (1,342 lines)

A custom speculative route prefetch system replacing Next.js's built-in `<Link prefetch>`. Built for Pages Router data-fetching patterns.

### Architecture

```
User activity
     │
     ▼
┌────────────────────┐
│  Priority Queue     │
│  hover (3)          │──────┐
│  pointer proximity (2) │   │
│  viewport (1)       │──┐  │
└────────────────────┘  │  │
                        ▼  ▼
                 ┌──────────────┐
                 │  window.fetch  │
                 │  interceptor   │   deduplicates inflight GETs
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │  /_next/data/ │
                 │  {buildId}/   │
                 │  ...json      │
                 └──────────────┘
```

### Features

- **Priority queue** — Three tiers: hover (3), pointer proximity (2), viewport (1). Max 2 concurrent, 32 pending, 128 tracked recent
- **`window.fetch` interceptor** — monkey-patches `fetch()` to share responses across duplicate requests. Cloned and shared with 5-second retention
- **Network-aware** — disables on slow connections (`slow-2g`, `2g`, or `saveData`). Subscribes to `navigator.connection` change events
- **Navigation claim** — `claimRouteWarmup()` keeps inflight warmups alive on real click, drops pending ones
- **Post-navigation pause** — suspends all speculative warmups after navigation until user activity resumes
- **Pages Router integration** — uses Next.js internals (`getRouteMatcher`, `getRouteRegex`) to resolve route hrefs to `/_next/data/{buildId}/...json` URLs

### Trigger Points (`SSRPrefetchLink`)

| Trigger | Detection | Root margin |
|---------|-----------|-------------|
| Viewport (touch) | `IntersectionObserver` | 120px |
| Pointer proximity (desktop) | Global pointer move listener | 120px x, 90px y |
| Hover/Focus | Native DOM events | N/A |

**Source:** `common/utils/route-prefetch.ts`, `components/shared/ssr-prefetch-link.tsx`, `hooks/useIntersectionObserver.ts`, `hooks/usePointerProximityObserver.ts`

---

## 3. Content Rendering & ISR

### Pages

| Route | Rendering | Purpose |
|-------|-----------|---------|
| `/` | SSR | Homepage with infinite-scroll posts, filter-aware categories/tags |
| `/posts/[slug]` | ISR (blocking) | Post detail with Lexical rich text, comments, similar posts |
| `/books` | SSR | Books grid with reading progress, infinite scroll, bookmark states |
| `/books/[slug]` | SSR | Book detail with chapter list, reading progress, continue-reading button |
| `/books/[slug]/chapters/[chapterSlug]` | SSR | Chapter reader with TOC sidebar, progress bar, password gate, comments |
| `/about` | ISR (3600s) | Author bio rendered from PayloadCMS Lexical |
| `/shelf` | SSR | User bookmark shelf (auth-required) |

### Lexical Rich Text Rendering

Uses `@payloadcms/richtext-lexical` `RichText` component with custom JSX converters for:

- **Headings** — anchor IDs preserved for fragment links
- **Images** — rendered via `ResponsiveImage` with LQIP blur placeholder → full image transition
- **YouTube embeds** — iframe video embeds
- **Tables** — `<colgroup>` widths, header states, text alignment, background colors, colspan/rowspan
- **EPUB-specific** — `epub-internal-link` resolved to chapter URLs via three-tier href matching
- **Code blocks** — syntax-highlighted via language class

**Source:** `components/shared/lexical-renderer.tsx`

---

## 4. Image Pipeline

Images are stored in **Cloudflare R2** with pre-computed variants generated by PayloadCMS. No on-demand transformations.

### Variant Strategy

| Variant | Width | Format | Purpose |
|---------|-------|--------|---------|
| `lowResUrl` | 20px | base64 WebP | Blur placeholder for LQIP |
| `optimizedUrl` | 1920px | WebP | Full resolution |
| 6 responsive | 480–1200px | WebP | `srcset` for `<picture>` |

### ResponsiveImage Component

- Progressive loading: CSS `blur(20px)` placeholder → full image (no flash)
- `<picture>` with WebP `srcSet` + JPG fallback
- Viewport detection (200px root margin) for eager/lazy loading
- `fill`, `intrinsic`, and aspect-ratio layout modes

**Source:** `components/shared/responsive-image.tsx`, `common/utils/image.ts`

---

## 5. Cloudflare Cache with Stale-While-Revalidate

Custom `readThroughCloudflareCache()` implementation using `caches.default` Cache API.

- **SWR pattern**: 1-hour fresh TTL, 24-hour stale TTL (anonymous) / 5-hour stale TTL (authenticated)
- **Cache key fingerprinting**: GraphQL query + variables → FNV-1a hash. Includes unverified JWT `sub` for user-specific partitioning (auth awareness without auth dependency)
- **Worker integration**: Uses `ctx.waitUntil()` for background refresh in Cloudflare Workers
- **Scoped cache tags**: `books:list`, `book:{id}`, `chapter:{id}`, `chapter-page:book:{id}:{slug}`, etc.

**Source:** `common/apis/cache.ts`, `common/apis/base.ts`

---

## 6. EPUB Internal Link Resolution

A three-tier matching system for resolving EPUB `href` attributes to chapter URLs:

1. **Exact path** — full path match against `chapterSourceKey`
2. **Suffix match** — trailing path components match
3. **Basename match** — filename match (least specific)

Handles URL encoding, `..` path resolution, and cross-platform path normalization.

**Source:** `common/utils/epub-link-resolver.ts`

---

## 7. Chapter Password Protection

PBKDF2-SHA256 password hashing with cookie-based proof tokens for multi-chapter unlock.

- Passwords hashed with **120,000 iterations** PBKDF2-SHA256
- **Proof tokens**: HMAC-signed tokens with 60-min TTL, stored in `chapter-password-proof` cookie
- **Multi-chapter unlock**: Cookie stores comma-separated proofs, normalized to keep latest per chapter
- **Version tracking**: Password version number auto-increments on change, invalidating old proofs

**Source:** `common/utils/chapter-password-proof.ts`, `pages/books/chapter-password-gate.tsx`, `pages/api/chapters/unlock.ts`

---

## Environment Variables

```bash
# PayloadCMS API
PAYLOAD_BASE_URL=https://cms.yourdomain.com
PAYLOAD_API_KEY=your-api-key
PAYLOAD_PREVIEW_SECRET=optional-preview-secret

# Auther OAuth client (PKCE public)
AUTH_BASE_URL=https://auth.yourdomain.com
BLOG_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxx
BLOG_REDIRECT_URI=https://blog.yourdomain.com/auth/callback
BLOG_POST_LOGOUT_REDIRECT_URI=https://blog.yourdomain.com
AUTH_SHARED_COOKIE_DOMAIN=.yourdomain.com    # optional, for cross-app cookies

# Deployment
NEXT_PUBLIC_SITE_URL=https://blog.yourdomain.com
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint + TypeScript |
| `pnpm test` | Vitest test suite |
| `pnpm test:watch` | Vitest in watch mode |

## File Map

```
pages/
├── index.tsx                      # Homepage (SSR, infinite scroll)
├── posts/[slug].tsx               # Post detail (ISR, Lexical, comments)
├── books/
│   ├── index.tsx                  # Books grid (SSR, infinite scroll)
│   ├── [slug].tsx                 # Book detail (SSR, chapters, progress)
│   └── [slug]/chapters/
│       └── [chapterSlug].tsx      # Chapter reader (SSR, TOC, password gate)
├── shelf.tsx                      # Bookmark shelf (SSR, auth-required)
├── about.tsx                      # About page (ISR)
├── auth/
│   ├── login.tsx                  # OAuth2 PKCE login initiator
│   ├── callback.tsx               # OAuth2 callback handler
│   └── logout.tsx                 # Logout handler
├── _app.tsx                       # Custom scroll restoration + analytics
├── _document.tsx                  # Google Analytics injection
└── api/                           # API routes (posts, books, comments, etc.)

components/
├── core/                          # Layout, header, metadata
├── shared/                        # LexicalRenderer, ResponsiveImage, SSRPrefetchLink
│   └── comments/                  # CommentsSection, CommentComposer, Thread
└── pages/                         # Page-specific components

common/
├── apis/                          # GraphQL wrappers (posts, books, chapters, etc.)
├── utils/
│   ├── blog-auth.ts               # OAuth2 PKCE implementation
│   ├── auth-cookies.ts            # Cookie management
│   ├── route-prefetch.ts          # 1,342-line route warmup system
│   ├── image.ts                   # R2 image utilities
│   ├── epub-link-resolver.ts      # EPUB internal link resolution
│   ├── chapter-password-proof.ts  # Password proof tokens
│   └── ...                        # Meta tags, date, tags, preview
└── constants.ts

hooks/
├── useHomePosts.ts                # Infinite-scroll posts feed
├── useBooksFeed.ts                # Infinite-scroll books feed
├── useReadingProgress.ts          # Real-time scroll-based progress
├── useIntersectionObserver.ts     # General-purpose scroll observer
└── usePointerProximityObserver.ts # Shared pointer proximity singleton

tests/                             # 40+ test files
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (Pages Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| Content API | PayloadCMS GraphQL |
| Auth | Auther (OAuth2 PKCE client) |
| Deployment | Cloudflare Workers + OpenNext |
| Image Storage | Cloudflare R2 |
| Testing | Vitest + jsdom + Testing Library |
| Cache | Cloudflare Cache API (SWR pattern) |

## Deployment

Deploys to Cloudflare Workers via GitHub Actions (`deploy-cloudflare.yml`). Required secrets:

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- `AUTH_BASE_URL`, `BLOG_CLIENT_ID`, `BLOG_REDIRECT_URI`
- `PAYLOAD_BASE_URL`, `PAYLOAD_API_KEY`

Push to `master` or trigger manually. The workflow builds with `opennextjs-cloudflare build` and deploys with `wrangler deploy`.
