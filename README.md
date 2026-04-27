This repository contains a personal blog built with Next.js and PayloadCMS. The live site is available at: https://blog.quanghuy.dev/

## What this project is

- A blog frontend implemented with Next.js (React + TypeScript).
- Content is sourced from PayloadCMS using GraphQL API with custom wrappers in `common/apis`.
- Rich text content is stored in Lexical JSON format from PayloadCMS.
- Images are served from Cloudflare R2 with on-the-fly transformations.

## Tech stack

- Next.js (app uses pages directory)
- React 19
- TypeScript
- Tailwind CSS v4 for styling (via `@tailwindcss/postcss`)
- PostCSS (Tailwind v4 plugin only)
- PayloadCMS (GraphQL API)
- Cloudflare R2 for image storage and transformation
- Lexical JSON for rich text content

## Key scripts

All scripts are defined in `package.json`:

- `pnpm dev` — start development server (next dev)
- `pnpm build` — build production assets (next build)
- `pnpm start` — run the production server (next start)
- `pnpm lint` — run ESLint and TypeScript checks
- `pnpm test` — run test suite with Vitest

## Environment variables

This project expects the following environment variables:

- `PAYLOAD_BASE_URL` — Base URL of your PayloadCMS instance (without /api/graphql)
- `PAYLOAD_API_KEY` — PayloadCMS API key for authentication

Local development example (use a `.env.local` file):

```
PAYLOAD_BASE_URL=https://your-payloadcms-instance.com
PAYLOAD_API_KEY=your_api_key_here
```

See `.env.local.example` for a template.

## Project structure (high level)

- `pages/` — Next.js pages including the homepage and dynamic post pages (`posts/[slug].tsx`)
- `components/` — React components used by pages and layout
  - `components/core` — site layout, header, metadata
  - `components/pages` — page-specific UI (index banner, posts listing, post content/header)
  - `components/shared` — reusable components (posts, categories, tags, cover image)
- `common/` — utilities and API wrappers
  - `common/apis` — GraphQL API wrappers for PayloadCMS (posts, categories, author)
  - `common/utils` — utility functions (image transformations, meta tags, tag normalization)
- `public/` — static assets (favicon and manifest)
- `styles/` — global Tailwind import (`index.css`)
- `types/` — shared TypeScript types (`cms.ts` for PayloadCMS types)
- `tests/` — test files for components, APIs, and utilities

## Notable implementation details

- Content is fetched from PayloadCMS GraphQL API with ISR (Incremental Static Regeneration).
- Images are stored in Cloudflare R2 and transformed on-the-fly using URL parameters.
- Rich text content is rendered with a custom Lexical renderer and local CSS styles.
- All posts are filtered by author (ID=1, quanghuy1242) and published status.
- Route warmups are handled by a custom Pages Router-aware scheduler instead of `next/link`'s default prefetch behavior.
- The warmup layer is shared across books, chapters, and other opted-in routes through `components/shared/SSRPrefetchLink`.
- Warmups are gated by user intent and network hints, including `navigator.connection.saveData` and slow connection types.
- Real navigations can claim an inflight warmup so the click reuses the same request instead of starting over.
- The implementation is Pages Router specific today; if the app migrates to App Router, this part of the route contract needs to be revisited.

## TypeScript & linting

- TypeScript is configured via `tsconfig.json` with strict settings enabled.
- ESLint is configured through `eslint-config-next` and can be run with `pnpm lint`.

## Development

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:

```bash
cp .env.local.example .env.local
# Edit .env.local with your PayloadCMS credentials
```

3. Start the dev server:

```bash
pnpm dev
```

Open http://localhost:3000

## Testing

Run the test suite:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

## Building & production

Build the app:

```bash
pnpm build
```

Start the production server locally:

```bash
pnpm start
```

## Deployment

This project deploys to Cloudflare Workers through GitHub Actions.

1. Add these repository secrets:

   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `PAYLOAD_BASE_URL`
   - `PAYLOAD_API_KEY`

2. Push to `master` or run the `Deploy to Cloudflare` workflow manually.

3. The workflow builds the app, uploads the Payload values as Worker secrets, and deploys the worker named `next-blog-payloadcms`.

## Where to look in the code

- **CMS integration**: `common/apis/*.ts` - GraphQL queries and API wrappers
- **Image utilities**: `common/utils/image.ts` - Cloudflare R2 transformations
- **Meta tags**: `common/utils/meta-tags.ts` - SEO meta tag generation
- **Pages and routing**: `pages/*`, dynamic post at `posts/[slug].tsx`
- **Route warmups**: `common/utils/route-prefetch.ts`, `components/shared/ssr-prefetch-link.tsx`
- **Styling**: `styles/index.css`, `tailwind.config.js`, `postcss.config.js`
- **Types**: `types/cms.ts` - PayloadCMS type definitions
- **Tests**: `tests/**/*.test.{ts,tsx}` - Component and utility tests

## Migration Status

This project was migrated from DatoCMS to PayloadCMS. See migration documentation:

- `MIGRATION_PLAN.md` - Original migration plan
- `MIGRATION_COMPLETE.md` - Phases 1-6 completion summary
- `PHASE_7_8_COMPLETE.md` - Phases 7-8 completion details

**Current Status**: Phases 1-8 complete (80% done)

- ✅ Environment setup
- ✅ Type system migrated
- ✅ API layer using PayloadCMS GraphQL
- ✅ Components updated
- ✅ Pages updated with ISR
- ⏳ Phase 9: Lexical rendering (pending)
- ⏳ Phase 10: Final deployment preparation
