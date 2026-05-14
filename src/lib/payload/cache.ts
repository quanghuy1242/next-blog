import { getCloudflareContext } from '@opennextjs/cloudflare';

const DEFAULT_FRESH_TTL_SECONDS = 60 * 60;
const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;
const AUTH_STALE_TTL_SECONDS = 5 * 60 * 60;
const CACHE_KEY_PARAM = '__payload_cache_key';
const CACHE_NAMESPACE = 'payload-graphql';
export const BOOKS_LIST_CACHE_TAG = 'books:list' as const;
const BOOK_CACHE_TAG_PREFIX = 'book:';
const BOOK_SLUG_CACHE_TAG_PREFIX = 'book:slug:';
const CHAPTER_CACHE_TAG_PREFIX = 'chapter:';
const CHAPTER_SLUG_CACHE_TAG_PREFIX = 'chapter:slug:';
const CHAPTERS_BY_BOOK_CACHE_TAG_PREFIX = 'chapters:book:';
const CHAPTER_PAGE_CACHE_TAG_PREFIX = 'chapter-page:book:';

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

function normalizeCacheTagValue(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    const normalizedValue = String(Math.trunc(value)).trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function buildScopedCacheTag(prefix: string, value: unknown): string | null {
  const normalizedValue = normalizeCacheTagValue(value);

  if (!normalizedValue) {
    return null;
  }

  return `${prefix}${normalizedValue}`;
}

function buildScopedRouteCacheTag(
  prefix: string,
  firstValue: unknown,
  secondValue: unknown
): string | null {
  const normalizedFirstValue = normalizeCacheTagValue(firstValue);
  const normalizedSecondValue = normalizeCacheTagValue(secondValue);

  if (!normalizedFirstValue || !normalizedSecondValue) {
    return null;
  }

  return `${prefix}${normalizedFirstValue}:${normalizedSecondValue}`;
}

export function normalizeCacheTags(tags: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => tag.length > 0)
    )
  );
}

export function buildBooksListCacheTags(): string[] {
  return [BOOKS_LIST_CACHE_TAG];
}

export function buildBookCacheTags(bookId: unknown): string[] {
  return normalizeCacheTags([buildScopedCacheTag(BOOK_CACHE_TAG_PREFIX, bookId)]);
}

export function buildBookSlugCacheTags(bookSlug: unknown): string[] {
  return normalizeCacheTags([buildScopedCacheTag(BOOK_SLUG_CACHE_TAG_PREFIX, bookSlug)]);
}

export function buildBookDetailCacheTags(bookId: unknown): string[] {
  return normalizeCacheTags([
    buildScopedCacheTag(BOOK_CACHE_TAG_PREFIX, bookId),
    buildScopedCacheTag(CHAPTERS_BY_BOOK_CACHE_TAG_PREFIX, bookId),
  ]);
}

export function buildChaptersByBookCacheTags(bookId: unknown): string[] {
  return normalizeCacheTags([
    buildScopedCacheTag(CHAPTERS_BY_BOOK_CACHE_TAG_PREFIX, bookId),
  ]);
}

export function buildChapterPageCacheTags(bookId: unknown, chapterId?: unknown): string[] {
  return normalizeCacheTags([
    buildScopedCacheTag(BOOK_CACHE_TAG_PREFIX, bookId),
    buildScopedCacheTag(CHAPTER_CACHE_TAG_PREFIX, chapterId),
    buildScopedCacheTag(CHAPTERS_BY_BOOK_CACHE_TAG_PREFIX, bookId),
  ]);
}

export function buildChapterPageLookupCacheTags(
  bookId: unknown,
  chapterSlug: unknown
): string[] {
  return normalizeCacheTags([
    buildScopedRouteCacheTag(CHAPTER_PAGE_CACHE_TAG_PREFIX, bookId, chapterSlug),
    buildScopedCacheTag(BOOK_CACHE_TAG_PREFIX, bookId),
    buildScopedCacheTag(CHAPTER_SLUG_CACHE_TAG_PREFIX, chapterSlug),
    buildScopedCacheTag(CHAPTERS_BY_BOOK_CACHE_TAG_PREFIX, bookId),
  ]);
}

export function buildChapterSlugCacheTags(chapterSlug: unknown): string[] {
  return normalizeCacheTags([buildScopedCacheTag(CHAPTER_SLUG_CACHE_TAG_PREFIX, chapterSlug)]);
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
  getCacheTags,
  settings,
}: {
  cacheKey: Request;
  fetchFresh: () => Promise<T>;
  getCacheTags?: (data: T) => string[] | null | undefined;
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
          getCacheTags,
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
  await storeCachedPayload(
    cache,
    cacheKey,
    freshPayload,
    getResolvedCacheTags(getCacheTags, freshPayload),
    staleTtlSeconds
  );

  return freshPayload;
}

async function refreshCache<T>(
  cache: Cache,
  cacheKey: Request,
  fetchFresh: () => Promise<T>,
  getCacheTags: ((data: T) => string[] | null | undefined) | undefined,
  staleTtlSeconds: number
): Promise<void> {
  try {
    const freshPayload = await fetchFresh();
    await storeCachedPayload(
      cache,
      cacheKey,
      freshPayload,
      getResolvedCacheTags(getCacheTags, freshPayload),
      staleTtlSeconds
    );
  } catch {
    // Keep serving the stale entry if the refresh fails.
  }
}

async function storeCachedPayload<T>(
  cache: Cache,
  cacheKey: Request,
  data: T,
  cacheTags: string[],
  staleTtlSeconds: number
): Promise<void> {
  try {
    const payload: CachedPayload<T> = {
      data,
      cachedAt: Math.floor(Date.now() / 1000),
    };

    const headers = new Headers({
      'Cache-Control': `public, s-maxage=${staleTtlSeconds}`,
      'Content-Type': 'application/json',
    });

    if (cacheTags.length > 0) {
      headers.set('Cache-Tag', cacheTags.join(','));
    }

    const response = new Response(JSON.stringify(payload), { headers });

    await cache.put(cacheKey, response);
  } catch {
    // Cache writes are best effort.
  }
}

function getResolvedCacheTags<T>(
  getCacheTags: ((data: T) => string[] | null | undefined) | undefined,
  data: T
): string[] {
  if (!getCacheTags) {
    return [];
  }

  try {
    return normalizeCacheTags(getCacheTags(data) ?? []);
  } catch {
    return [];
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
