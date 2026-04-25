# Cloudflare Cache Strategy TDD for SSR and Pseudo-ISR

> This document defines the cache strategy for this repository after the Cloudflare migration.
> It is a technical design document, not a task backlog. The goal is to describe the architecture, request flow, failure modes, and rollout logic for the cache layers that matter to this blog.

## 1. Purpose

This blog has two very different kinds of routes:

- routes that already behave like ISR and can benefit from OpenNext-managed incremental caching
- routes that remain SSR because the response changes with auth state or request context

The mistake to avoid is treating those as the same problem.

OpenNext regional cache is the immediate platform-level improvement for the ISR side. It reduces the cost of fetching incremental cache entries from R2 and makes cache hits faster in the Worker runtime. It does not magically convert SSR into static rendering, and it does not cache per-user HTML safely by itself.

For the SSR side, the right move is to cache the data layer, not the rendered page. In this repo that means caching Payload API responses or route-adjacent data envelopes, then letting the page still render on the request path with the correct auth semantics.

This document describes the design that keeps those two worlds separate while still giving the app a meaningful speedup.

## 2. Current State

The repository currently has three route classes:

- ISR-style public routes such as `/about`, `/posts/[slug]`, and `/categories`
- SSR routes such as `/`, which uses request-time rendering
- auth-sensitive SSR routes such as the books and chapter pages, which vary based on the presence and meaning of the auth token

The important detail is that the books and chapter experience is not just "slow SSR". It is "SSR with request-dependent behavior". That means a shared HTML cache is risky unless the cache key is carefully scoped.

The current OpenNext config already uses an R2-backed incremental cache and a Durable Object queue. That is the right baseline. The missing piece is the regional cache layer in front of R2.

## 3. Immediate Platform Change

The first concrete change is already in `open-next.config.ts`:

- wrap `r2IncrementalCache` with `withRegionalCache(...)`
- use `mode: 'long-lived'`

That choice is deliberate.

`long-lived` gives the best fit for a content blog where the public routes revalidate on a timer and stale content should be short-lived, not aggressively expired. The regional cache becomes a hot read path in front of R2, which reduces storage round-trips and improves hit latency.

This is the important boundary:

- regional cache helps OpenNext-managed ISR/SSG cache reads
- SSR routes still execute on every request
- SSR speedups must come from request-time data caching or response splitting

So this setting is the right "immediate" improvement, but it is only one layer of the broader cache plan.

## 4. Architecture Overview

The target design has four layers:

1. OpenNext regional cache
2. R2 as the durable incremental cache store
3. A Payload data cache for SSR-heavy routes
4. A queue-based refresh path for controlled background regeneration

Conceptually:

```text
Client
  -> Worker
    -> regional cache
      -> R2 incremental cache
        -> Payload API
```

For SSR pages that depend on Payload data:

```text
Client
  -> Worker
    -> auth / scope resolution
      -> Payload data cache
        -> Payload API
```

The difference matters because the first path is page cache infrastructure and the second path is data cache infrastructure.

If the repo tries to solve both problems with one mechanism, the result will either be unsafe or ineffective.

## 5. What Regional Cache Actually Solves

Regional cache is useful because R2 is a single-region object store. That means the storage is durable, but a cache read still incurs object-storage latency.

The regional cache gives the app a nearby layer that can hold recently used incremental cache entries. In practice, that means:

- fewer reads to R2
- lower latency for cached ISR/SSG pages
- a faster first-byte path for routes already in the incremental cache

This is especially helpful for the pages that already use time-based revalidation:

- `/about`
- `/posts/[slug]`
- `/categories`

These are the routes where a regional cache is a clean win.

What it does not do:

- it does not turn SSR into ISR
- it does not safely cache per-user HTML
- it does not remove the need for auth-aware logic

That is the boundary this repo should preserve.

## 6. Why SSR Needs a Different Cache Strategy

The books and chapter routes are SSR because the rendering depends on auth context.

That means the response can differ depending on:

- whether the user is authenticated
- whether the token is present
- what access scope the token grants
- whether the route should show a public preview or a private version

This is the wrong shape for a shared page cache.

The right shape is a data cache.

Instead of caching the rendered HTML for every request, cache the Payload response that feeds the page. Then let the page render on request with the correct auth-aware branching.

That preserves correctness while reducing the expensive part of the request:

- the round trip to Payload
- repeated transforms on unchanged data
- repeated fetch work for the same book or chapter data

In other words, the blog stays SSR where it needs to stay SSR, but it stops paying the full upstream cost on every request.

## 7. Proposed Data Cache Model for Payload

The Payload cache should store a serialized response envelope in R2.

A practical envelope needs more than the raw JSON body. It should include metadata so the Worker can make a freshness decision without guessing.

Suggested record shape:

```text
cache key
  scope: anonymous | authenticated | role bucket | other stable audience bucket
  route identity: book slug, chapter slug, category slug, etc.
  source version: optional content version or updatedAt marker
  fetchedAt
  softTtlSec
  hardTtlSec
  body
  headers or selected response metadata
```

The key design rule is:

- key by stable audience and route shape
- do not key by raw bearer token unless the content is truly user-specific

If the token changes often but the visible content does not, caching by token destroys the hit rate.

If the content truly differs per user, then the route is not a good candidate for shared cache. In that case the best optimization is to cache only the public parts and keep the private part request-time.

## 8. Request Flow for SSR Routes

For a books or chapters request, the Worker should follow this logic:

1. resolve auth scope
2. build a stable cache key from route + scope
3. look up the cached Payload envelope
4. if fresh, serve the cached data immediately
5. if stale but still acceptable, serve stale data and schedule refresh
6. if missing, fetch Payload, store the response, then serve it

That gives the app pseudo-ISR behavior without pretending the entire HTML is static.

The important part is that stale serving is a policy choice, not an accident.

You do not want every miss to block the user while Payload regenerates if the cached object is still good enough to serve. But you also do not want to serve stale forever. That is why the envelope needs both a soft TTL and a hard TTL.

Recommended semantics:

- soft TTL: page can be served stale while refresh is queued
- hard TTL: page must be refreshed before it can be served again

This gives predictable behavior under load and during upstream failures.

## 9. Refresh Path and Queue Behavior

The queue is the right place for refresh work that should be reliable.

`ctx.waitUntil()` is useful for opportunistic background work after a response has already been sent, but it is not the same thing as guaranteed job processing. A queue is better when you want retries, deduplication, and a durable refresh pipeline.

The refresh path should do the following:

- receive a request to refresh a key
- dedupe concurrent refreshes for the same route and audience
- fetch fresh content from Payload
- overwrite the R2 record
- update any metadata needed for freshness tracking

If Payload content changes through a webhook, that webhook should also target the same key-space. That gives the system a clean invalidation story:

- timed refresh for drift control
- webhook-driven refresh for content changes

This is much safer than hoping the next user request will eventually repair the cache.

## 10. Why Not Cache the Final HTML

Caching rendered HTML is tempting because it looks simple.

For this repo, it is the wrong default because:

- the HTML can differ based on auth state
- the page may include request-dependent controls or affordances
- one shared HTML response can leak private content if the cache key is wrong
- user-specific HTML fragments destroy cache reuse if the key is too granular

Caching the Payload response is safer because the HTML still gets rendered inside the request boundary where auth checks are already happening.

That gives the app a narrower cache surface and keeps the security boundary clear.

## 11. Where Regional Cache Fits in This Design

Regional cache is not the answer to the auth problem. It is the answer to the durable cache latency problem.

The intended stack is:

- regional cache for hot incremental cache reads
- R2 for durable incremental cache storage
- Payload data cache for auth-sensitive route data
- queue for controlled refresh

That arrangement gives three benefits:

1. public ISR pages get faster immediately
2. SSR pages can benefit from a separate data cache without being flattened into static HTML
3. background refresh can be controlled instead of noisy

If the cache becomes noisy later, OpenNext also has a queue cache layer that can sit in front of the queue. That is an optional optimization, not a first-step requirement. It is useful when revalidation traffic gets spiky enough that the queue should also be de-duplicated by a small regional TTL.

## 12. Failure Modes

Any cache design should assume failure, not just success.

The main failure modes here are:

### 12.1 Cache miss

This is normal on first request, after purge, or after eviction.

Expected behavior:

- fall back to Payload
- write the fresh response back to R2
- return the response without breaking the route

### 12.2 Stale hit

This is acceptable only if the stale window is bounded.

Expected behavior:

- serve stale content
- schedule refresh
- update the cache in the background

### 12.3 Refresh failure

If Payload is slow or unavailable, the cache should degrade gracefully.

Expected behavior:

- keep serving within the soft TTL window
- stop promoting failed refreshes to hard failures unless the content is truly expired
- record the failure so it is visible in logs

### 12.4 Auth scope mismatch

This is the most dangerous failure because it can expose content incorrectly.

Expected behavior:

- if the scope cannot be resolved confidently, bypass shared cache
- never fall back to a token-specific shared key unless the token itself is the intended scope

### 12.5 Queue backlog

If the queue falls behind, the app should remain usable.

Expected behavior:

- reads still succeed from the last known cache entry
- refresh latency increases, but the route does not fail by default

## 13. What This Means for the Blog Specifically

For this repository, the right division is:

- keep current ISR routes on OpenNext incremental cache + regional cache
- keep SSR routes on request-time rendering
- add a Payload data cache only where SSR is doing repeated upstream work

That means:

- `/about`, `/posts/[slug]`, and `/categories` benefit from the new regional cache immediately
- `/books` and chapter pages can get faster only if their data-fetching layer is cached
- the homepage remains SSR unless its data access pattern is changed separately

The cache plan should therefore not be written as if everything is one route class.

The blog has a mixed topology, and the cache architecture should reflect that.

## 14. Rollout Plan

This is not a ticket list. It is the operational order in which the system should evolve.

### Phase 1: Enable regional cache

This is the config-only change already applied in `open-next.config.ts`.

The result should be:

- lower latency for ISR page cache reads
- fewer R2 hits for repeated cache lookups
- no change to SSR behavior

### Phase 2: Add the Payload data cache wrapper

This is the first real pseudo-ISR layer for auth-sensitive routes.

The result should be:

- faster books and chapter requests on repeated access
- stale-safe serving with a refresh path
- controlled cache keys by audience

### Phase 3: Add webhook-driven invalidation

Once the cache exists, content mutation needs to push invalidation rather than wait for TTL expiry.

The result should be:

- reduced staleness after publish
- better cache hit quality
- less reliance on a user request to refresh stale data

### Phase 4: Add observability

After the behavior is correct, make the cache visible.

The result should be:

- clear hit/miss/refresh logs
- route-level visibility into stale serving
- easier debugging when Payload or R2 is the bottleneck

## 15. Acceptance Criteria

This strategy is successful if the following statements are true:

- OpenNext regional cache is enabled in `open-next.config.ts`
- ISR pages keep their current semantics but fetch faster in Cloudflare
- SSR routes continue to render per request
- the books and chapter routes do not leak auth-specific content through a shared HTML cache
- the Payload data cache uses stable audience keys rather than raw tokens
- stale content can be served temporarily while refresh happens in the background
- a cache miss still returns a valid page by falling back to Payload

That is the standard for "faster without breaking correctness."

## 16. Decision Summary

The cache strategy for this repo should be:

- OpenNext regional cache for ISR acceleration
- R2 as the durable incremental cache store
- queue-based refresh for time-based revalidation
- data-layer caching for auth-sensitive SSR routes
- no shared HTML cache for user-dependent pages

This keeps the architecture aligned with how the site actually behaves today and leaves room to make the books and chapters experience faster without risking auth leakage.
