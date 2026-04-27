# Route Prefetch

This document describes the generic warmup behavior for route links.

The implementation lives in `common/utils/route-prefetch.ts`.

It is generic across route families in this project, but it currently assumes
the Next.js Pages Router data model. If this app migrates to App Router, the
warmup request construction and fetch-sharing contract will need to be updated.

The goal is simple:

- Warm the SSR payload cache for supported pages.
- Do it immediately on hover and when a link enters the viewport.
- Keep the number of concurrent warmups bounded.
- Keep a small local registry so we do not warm the same route repeatedly in one session.
- Avoid any hover delay.

## Behavior

The client uses a dedicated `SSRPrefetchLink` wrapper for routes that opt in to this warmup flow.

- Hover or focus on a link schedules an immediate warmup.
- On mobile and other touch/coarse-pointer devices, when a link becomes visible in the viewport it schedules a warmup immediately.
- If that link scrolls back out of view before the warmup completes, the pending request is canceled and the scheduler gives priority to the newly visible links.
- On desktop fine-pointer devices, a pointer-proximity window around the mouse behaves the same way: nearby visible links warm immediately, and stale ones are canceled when the pointer moves away.
- If the user clicks a link while its warmup is already in flight, that click claims the existing warmup so unmount cleanup does not abort it.
- If the user clicks while a warmup is still only queued, the queued task is dropped and the navigation request proceeds on its own instead of letting the stale queued warmup create a second fetch later.
- The wrapper disables native viewport prefetch on `next/link` for these routes so the custom scheduler owns the behavior we are tuning.
- The warmup request uses the same Next data URL the pages router fetches on click, including any dynamic route query string and its `URLSearchParams` encoding, so an in-flight warmup can be reused by the navigation request instead of starting over.
- Once the fetch interceptor is installed, any matching warmup-capable data GET that reaches it also registers itself as shareable, so later identical requests can attach to the same response even if the scheduler was not the caller that started the first one.
- Successful warmups are kept around briefly after completion so a click that lands just after the fetch resolves can still reuse the same response.
- In environments where the Next build id is unavailable, the warmup falls back to the canonical route path to keep local tests and fallbacks working.
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

The queue is intentionally small so the latest visible window wins on mobile. If the user scrolls past a long list quickly, older viewport tasks should be dropped or aborted in favor of newer links that are actually on screen.

The registry is a hint, not a cache oracle. The browser cannot reliably inspect Cloudflare KV or Cache API state, so the client only tracks what it has already asked the server to warm.

## Priority

Hover and focus are treated as higher priority than pointer-proximity warming, which is higher priority than viewport warming.

- Hover/focus should win when a route is both visible and actively targeted.
- Clicks should keep an in-flight warmup alive, but they should discard a queued warmup that has not started yet.
- Pointer warming should fill the gaps for desktop users who move the cursor through dense link lists.
- Viewport warming should fill the gaps for touch and tablet users.
- The queue is throttled with a small semaphore-style pool so a large table of contents does not flood the origin.
- Pointer warming is cancelable. When the pointer moves away before a warmup completes, the scheduler aborts or drops that work and gives the next visible links priority.
- Viewport warming is cancelable for the same reason on mobile.

## Routes Covered

The current app usage is currently focused on book and chapter surfaces:

- Book cards and book covers.
- Chapter lists.
- Chapter table-of-contents links.
- Chapter previous/next links.
- Chapter content links that resolve to another chapter.
- The homepage `Books` CTA card and the mobile books card in the category rail.

The scheduler itself is route-agnostic, so new route families can opt in later without changing the component contract.

Desktop stays hover-first, then pointer-proximity aware. Viewport warming is only enabled when the device reports a coarse pointer or no hover capability.

## Notes

- This custom warmup is additive to normal navigation.
- The implementation should stay simple and predictable.
- If we later want route bundle prefetch as well, we can add it to the same scheduler without changing the component API.
