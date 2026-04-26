Pattern:

```txt
Cache hit but stale
  -> return stale response immediately
  -> ctx.waitUntil(refresh cache in background)
```

So user does **not** wait for Turso.

Example:

```ts
const FRESH_TTL = 30 * 60        // 30 minutes -> Please use 1 hour of fresh TTL
const STALE_TTL = 24 * 60 * 60   // 24 hours

type CachedPayload<T> = {
  data: T
  cachedAt: number
}

async function getCachedJson<T>(
  request: Request,
  ctx: ExecutionContext,
  fetchFresh: () => Promise<T>
): Promise<Response> {
  const cache = caches.default
  const cacheKey = new Request(request.url, { method: "GET" })
  const now = Math.floor(Date.now() / 1000)

  const cached = await cache.match(cacheKey)

  if (cached) {
    const payload = await cached.json<CachedPayload<T>>()
    const age = now - payload.cachedAt

    // Fresh cache: return immediately
    if (age < FRESH_TTL) {
      return Response.json(payload.data, {
        headers: {
          "X-Cache": "HIT",
          "Cache-Control": "public, max-age=60",
        },
      })
    }

    // Stale cache: return immediately, refresh in background
    if (age < STALE_TTL) {
      ctx.waitUntil(
        refreshCache(cache, cacheKey, fetchFresh)
      )

      return Response.json(payload.data, {
        headers: {
          "X-Cache": "STALE",
          "Cache-Control": "public, max-age=60",
        },
      })
    }
  }

  // No usable cache: must block and fetch fresh
  const data = await fetchFresh()

  await putCache(cache, cacheKey, data)

  return Response.json(data, {
    headers: {
      "X-Cache": "MISS",
      "Cache-Control": "public, max-age=60",
    },
  })
}

async function refreshCache<T>(
  cache: Cache,
  cacheKey: Request,
  fetchFresh: () => Promise<T>
) {
  try {
    const data = await fetchFresh()
    await putCache(cache, cacheKey, data)
  } catch {
    // Keep stale cache if refresh fails
  }
}

async function putCache<T>(
  cache: Cache,
  cacheKey: Request,
  data: T
) {
  const payload: CachedPayload<T> = {
    data,
    cachedAt: Math.floor(Date.now() / 1000),
  }

  const response = Response.json(payload, {
    headers: {
      // This controls how long the object can remain in Cache API.
      "Cache-Control": "public, s-maxage=86400",
    },
  })

  await cache.put(cacheKey, response)
}
```

Behavior:

```txt
0–30 min:
  return cache instantly

30 min–24h:
  return stale cache instantly
  refresh with Turso in background

No cache / expired / evicted:
  block and query Turso
```

One caveat: if 20 requests arrive while stale, all 20 can trigger background refreshes. You can reduce that by only refreshing probabilistically:

```ts
if (Math.random() < 0.1) {
  ctx.waitUntil(refreshCache(cache, cacheKey, fetchFresh))
}
```

Or only refresh after a larger stale threshold:

```ts
if (age > FRESH_TTL && age < STALE_TTL) {
  ctx.waitUntil(refreshCache(cache, cacheKey, fetchFresh))
}
```