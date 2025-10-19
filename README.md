This repository contains a personal blog built with Next.js and DatoCMS. The live site is available at: https://blog.quanghuy.dev/

## What this project is

- A blog frontend implemented with Next.js (React + TypeScript).
- Content is sourced from DatoCMS using the `react-datocms` client and custom API wrappers in `common/apis`.
- Markdown content is transformed and rendered with `remark` and a set of custom directives (see `common/directive` and `components/directives`).

## Tech stack

- Next.js (app uses pages directory)
- React 18
- TypeScript
- Tailwind CSS for styling (with `@tailwindcss/typography`)
- PostCSS (with `postcss-preset-env` and `autoprefixer`)
- DatoCMS (`react-datocms`)
- remark + remark-directive + remark-html for markdown parsing

## Key scripts

All scripts are defined in `package.json`:

- `npm run dev` — start development server (next)
- `npm run build` — build production assets (next build)
- `npm run start` — run the production server (next start)
- `npm run lint` — run Next.js/Eslint checks

## Environment variables

This project expects the following environment variables (also referenced in `vercel.json` and `next.config.mjs`):

- `NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN` — DatoCMS read API token used to fetch published content
- `NEXT_EXAMPLE_CMS_DATOCMS_PREVIEW_SECRET` — (optional) preview secret used for preview mode with DatoCMS

When deploying to Vercel, the `vercel.json` maps these to project secrets (see `build.env` for build-time token).

Local development example (use a .env.local file):

```
NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN=your_datocms_read_token
NEXT_EXAMPLE_CMS_DATOCMS_PREVIEW_SECRET=optional_preview_secret
```

## Project structure (high level)

- `pages/` — Next.js pages including the homepage and dynamic post pages (`posts/[slug].tsx`)
- `components/` — React components used by pages and layout
  - `components/core` — site layout, header, metadata
  - `components/pages` — page-specific UI (index banner, posts listing, post content/header)
  - `components/directives` — UI for custom markdown directives (e.g., polls)
- `common/` — utilities and API wrappers
  - `common/apis` — small wrappers to fetch posts, authors, and slugs
  - `common/directive` — remark directive handlers and helpers
  - `common/markdown-to-html.ts` — markdown transformation pipeline
- `public/` — static assets (favicon and manifest)
- `styles/` — global Tailwind import (`index.css`)
- `types/` — shared TypeScript types (e.g., `datocms.ts`)

## Notable implementation details

- The project uses `remark` with `remark-directive` to support custom directives in Markdown (see `common/directive` and `components/directives` for examples like YouTube embeds and polls).
- Tailwind is configured in `tailwind.config.js` and the repo includes a custom typography variant for directive styling.
- `next.config.mjs` includes a `transpilePackages` array to transpile several packages that ship non-ESM or modern syntax.

## TypeScript & linting

- TypeScript is configured via `tsconfig.json` with strict settings enabled.
- ESLint is configured through `eslint-config-next` and can be run with `npm run lint`.

## Development

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000

## Building & production

Build the app:

```bash
npm run build
```

Start the production server locally:

```bash
npm run start
```

## Deployment

This project is prepared for deployment on Vercel. Ensure the environment variables listed above are set in your Vercel project settings or in `vercel.json` as project secrets.

## Where to look in the code

- Fetching and CMS integration: `common/apis/*.ts`
- Markdown parsing and custom directives: `common/markdown-to-html.ts`, `common/directive/*`, `components/directives/*`
- Pages and routing: `pages/*`, dynamic post at `posts/[slug].tsx`
- Styling: `styles/index.css`, `tailwind.config.js`, `postcss.config.js`
