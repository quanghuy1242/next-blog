import { getCloudflareContext } from '@opennextjs/cloudflare';

const DEFAULT_FRESH_TTL_SECONDS = 60 * 60;
const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;
const AUTH_STALE_TTL_SECONDS = 5 * 60 * 60;
const CACHE_KEY_PARAM = '__payload_cache_key';
const CACHE_NAMESPACE = 'payload-graphql';

export interface PayloadCacheSettings {
  freshTtlSeconds?: number;
  staleTtlSeconds?: number;
}

interface CachedPayload<T> {
  data: T;
  cachedAt: number;
}

interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

export const ONE_HOUR_PAYLOAD_CACHE: PayloadCacheSettings = Object.freeze({
  freshTtlSeconds: DEFAULT_FRESH_TTL_SECONDS,
  staleTtlSeconds: DEFAULT_STALE_TTL_SECONDS,
});

export const AUTH_PAYLOAD_CACHE: PayloadCacheSettings = Object.freeze({
  freshTtlSeconds: DEFAULT_FRESH_TTL_SECONDS,
  staleTtlSeconds: AUTH_STALE_TTL_SECONDS,
});

export function buildPayloadCacheKey(
  requestUrl: string,
  fingerprint: unknown
): Request {
  const url = new URL(requestUrl);
  const serializedFingerprint = stableSerialize({
    namespace: CACHE_NAMESPACE,
    fingerprint,
  });

  url.searchParams.set(
    CACHE_KEY_PARAM,
    `${hashString(serializedFingerprint)}-${serializedFingerprint.length}`
  );

  return new Request(url.toString(), { method: 'GET' });
}

export async function readThroughCloudflareCache<T>({
  cacheKey,
  fetchFresh,
  settings,
}: {
  cacheKey: Request;
  fetchFresh: () => Promise<T>;
  settings?: PayloadCacheSettings;
}): Promise<T> {
  const cache = getDefaultCache();

  if (!cache) {
    return fetchFresh();
  }

  const freshTtlSeconds =
    settings?.freshTtlSeconds ?? DEFAULT_FRESH_TTL_SECONDS;
  const staleTtlSeconds =
    settings?.staleTtlSeconds ?? DEFAULT_STALE_TTL_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const cachedPayload = await parseCachedPayload<T>(cachedResponse);

    if (cachedPayload) {
      const ageSeconds = Math.max(0, nowSeconds - cachedPayload.cachedAt);

      if (ageSeconds < freshTtlSeconds) {
        return cachedPayload.data;
      }

      if (ageSeconds < staleTtlSeconds) {
        const refreshPromise = refreshCache(
          cache,
          cacheKey,
          fetchFresh,
          staleTtlSeconds
        );
        const waitUntil = await getWaitUntil();

        if (waitUntil) {
          waitUntil.waitUntil(refreshPromise);
        }

        return cachedPayload.data;
      }
    }
  }

  const freshPayload = await fetchFresh();
  await storeCachedPayload(cache, cacheKey, freshPayload, staleTtlSeconds);

  return freshPayload;
}

async function refreshCache<T>(
  cache: Cache,
  cacheKey: Request,
  fetchFresh: () => Promise<T>,
  staleTtlSeconds: number
): Promise<void> {
  try {
    const freshPayload = await fetchFresh();
    await storeCachedPayload(cache, cacheKey, freshPayload, staleTtlSeconds);
  } catch {
    // Keep serving the stale entry if the refresh fails.
  }
}

async function storeCachedPayload<T>(
  cache: Cache,
  cacheKey: Request,
  data: T,
  staleTtlSeconds: number
): Promise<void> {
  try {
    const payload: CachedPayload<T> = {
      data,
      cachedAt: Math.floor(Date.now() / 1000),
    };

    const response = new Response(
      JSON.stringify(payload),
      {
        headers: {
          'Cache-Control': `public, s-maxage=${staleTtlSeconds}`,
          'Content-Type': 'application/json',
        },
      }
    );

    await cache.put(cacheKey, response);
  } catch {
    // Cache writes are best effort.
  }
}

async function parseCachedPayload<T>(
  response: Response
): Promise<CachedPayload<T> | null> {
  try {
    const payload = (await response.json()) as Partial<CachedPayload<T>>;

    if (
      typeof payload.cachedAt !== 'number' ||
      !Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      return null;
    }

    return payload as CachedPayload<T>;
  } catch {
    return null;
  }
}

async function getWaitUntil(): Promise<WaitUntilContext | null> {
  try {
    const { ctx } = await getCloudflareContext({ async: true });

    if (ctx && typeof ctx.waitUntil === 'function') {
      return ctx as WaitUntilContext;
    }
  } catch {
    // Ignore missing Cloudflare context outside the Worker runtime.
  }

  return null;
}

function stableSerialize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
      );

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getDefaultCache(): Cache | null {
  const cacheStorage = globalThis.caches as
    | (CacheStorage & { default?: Cache | null })
    | undefined;

  return cacheStorage?.default ?? null;
}
