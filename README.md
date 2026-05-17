# next-blog

Personal blog powered by **vinext** (Vite-based Next.js), consuming content from a **PayloadCMS GraphQL API** and authenticating via **Auther** (OAuth2 PKCE). Deployed on **Cloudflare Workers**.

Live at <https://blog.quanghuy.dev/>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | vinext + React 19 + TypeScript |
| Build | Vite + `@vitejs/plugin-rsc` |
| Styling | Tailwind CSS v4 |
| Content API | PayloadCMS GraphQL |
| Auth | Auther (OAuth2 PKCE client) |
| Deployment | Cloudflare Workers + `@cloudflare/vite-plugin` |
| Image Storage | Cloudflare R2 |
| Testing | Vitest + Testing Library |
| Linting | oxlint + tsgo |

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start dev server (port 3001) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm deploy` | Deploy to Cloudflare Workers |
| `pnpm lint` | oxlint + TypeScript check |
| `pnpm test` | Vitest test suite |
| `pnpm test:watch` | Vitest in watch mode |

## Environment Variables

```bash
# PayloadCMS API
PAYLOAD_BASE_URL=https://cms.yourdomain.com
PAYLOAD_API_KEY=your-api-key

# Auther OAuth client (PKCE public)
AUTH_BASE_URL=https://auth.yourdomain.com
BLOG_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxx
BLOG_REDIRECT_URI=https://blog.yourdomain.com/auth/callback
BLOG_POST_LOGOUT_REDIRECT_URI=https://blog.yourdomain.com
AUTH_SHARED_COOKIE_DOMAIN=.yourdomain.com
```
