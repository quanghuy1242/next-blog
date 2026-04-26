# Book Route Prefetch

This document describes the custom warmup behavior for book and chapter links.

The goal is simple:

- Warm the SSR payload cache for book and chapter pages.
- Do it immediately on hover and when a link enters the viewport.
- Keep the number of concurrent warmups bounded.
- Keep a small local registry so we do not warm the same route repeatedly in one session.
- Avoid any hover delay.

## Behavior

The client uses a dedicated `SSRPrefetchLink` wrapper for book and chapter routes.

- Hover or focus on a link schedules an immediate warmup.
- On mobile and other touch/coarse-pointer devices, when a link becomes visible in the viewport it schedules a warmup once.
- The wrapper disables native viewport prefetch on `next/link` for these routes so the custom scheduler owns the behavior we are tuning.
- The warmup request is a same-origin `GET` to the canonical route path.
- The request includes the current auth cookies, so the server can warm the correct auth-scoped payload cache entry.
- External links, malformed URLs, and self-links are ignored.

## Local Registry

The client keeps a small in-memory registry of recently warmed routes.

- The registry is keyed by canonical href, not by the browser cache state.
- It only tracks what this session has already warmed successfully.
- It is bounded to keep memory usage predictable.
- It expires entries after a short TTL so the same route can be warmed again later in the session.

Current bounds:

- `2` concurrent warmup requests.
- `32` pending warmup tasks.
- `128` recently warmed URLs.
- `15 minutes` of client-side warmup memory.

The registry is a hint, not a cache oracle. The browser cannot reliably inspect Cloudflare KV or Cache API state, so the client only tracks what it has already asked the server to warm.

## Priority

Hover and focus are treated as higher priority than viewport warming.

- Hover/focus should win when a route is both visible and actively targeted.
- Viewport warming should fill the gaps for touch and tablet users.
- The queue is throttled with a small semaphore-style pool so a large table of contents does not flood the origin.

## Routes Covered

This warmup is applied to the book and chapter surfaces only:

- Book cards and book covers.
- Chapter lists.
- Chapter table-of-contents links.
- Chapter previous/next links.
- Chapter content links that resolve to another chapter.
- The homepage `Books` CTA card and the mobile books card in the category rail.

Desktop stays hover-first. Viewport warming is only enabled when the device reports a coarse pointer or no hover capability.

## Notes

- This custom warmup is additive to normal navigation.
- The implementation should stay simple and predictable.
- If we later want route bundle prefetch as well, we can add it to the same scheduler without changing the component API.
