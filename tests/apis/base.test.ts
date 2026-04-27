import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const PAYLOAD_BASE_URL = 'https://payload.example.com';

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

function createCacheMock() {
  return {
    match: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  };
}

function createCachedResponse<T>(data: T, cachedAt: number) {
  return new Response(
    JSON.stringify({
      data,
      cachedAt,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

function createJwtToken(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' }
): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode(header)}.${encode(payload)}.signature`;
}

describe('fetchAPI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PAYLOAD_BASE_URL', PAYLOAD_BASE_URL);
    vi.stubEnv('PAYLOAD_API_KEY', 'payload-api-key');
    vi.unstubAllGlobals();
    getCloudflareContextMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('does not mix in the API key when no auth token is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPIWithAuthToken } = await import('common/apis/base');

    const result = await fetchAPIWithAuthToken<{ ok: boolean }>(
      'query Test { ok }'
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `${PAYLOAD_BASE_URL}/api/graphql`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'query Test { ok }',
          variables: undefined,
        }),
      })
    );
  });

  test('uses the bearer token when one is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPIWithAuthToken } = await import('common/apis/base');

    await fetchAPIWithAuthToken<{ ok: boolean }>('query Test { ok }', {
      authToken: 'token-123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${PAYLOAD_BASE_URL}/api/graphql`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        },
        body: JSON.stringify({
          query: 'query Test { ok }',
          variables: undefined,
        }),
      })
    );
  });

  test('partitions cache entries by chapter password proof cache key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const cacheMock = createCacheMock();
    cacheMock.match.mockResolvedValue(null);

    vi.stubGlobal('caches', {
      default: cacheMock,
    });

    const { fetchAPI } = await import('common/apis/base');

    await fetchAPI<{ ok: boolean }>('query Test { ok }', {
      cache: {},
      cacheKeySuffix: 'proof-a',
      requestHeaders: {
        'x-chapter-password-proof': 'proof-a',
      },
    });

    await fetchAPI<{ ok: boolean }>('query Test { ok }', {
      cache: {},
      cacheKeySuffix: 'proof-b',
      requestHeaders: {
        'x-chapter-password-proof': 'proof-b',
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${PAYLOAD_BASE_URL}/api/graphql`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-chapter-password-proof': 'proof-a',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${PAYLOAD_BASE_URL}/api/graphql`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-chapter-password-proof': 'proof-b',
        }),
      })
    );

    const firstCacheKey = cacheMock.match.mock.calls[0]?.[0] as Request | undefined;
    const secondCacheKey = cacheMock.match.mock.calls[1]?.[0] as Request | undefined;

    expect(firstCacheKey).toBeInstanceOf(Request);
    expect(secondCacheKey).toBeInstanceOf(Request);
    expect(firstCacheKey?.url).not.toBe(secondCacheKey?.url);
  });

  test('returns a fresh Cloudflare cache hit without calling Payload', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const cacheMock = createCacheMock();
    cacheMock.match.mockImplementation(() =>
      Promise.resolve(
        createCachedResponse(
          {
            title: 'cached',
          },
          Math.floor(now / 1000) - 60
        )
      )
    );

    vi.stubGlobal('caches', {
      default: cacheMock,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPI } = await import('common/apis/base');
    const result = await fetchAPI<{ title: string }>('query Test { title }', {
      cache: {},
    });

    expect(result).toEqual({
      title: 'cached',
    });
    expect(cacheMock.match).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMock.put).not.toHaveBeenCalled();
  });

  test('serves stale cache immediately and refreshes it in the background', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const waitUntil = vi.fn();
    getCloudflareContextMock.mockResolvedValue({
      ctx: {
        waitUntil,
      },
      env: {},
      cf: undefined,
    });

    const cacheMock = createCacheMock();
    cacheMock.match.mockResolvedValue(
      createCachedResponse(
        {
          title: 'stale',
        },
        Math.floor(now / 1000) - 3_700
      )
    );

    vi.stubGlobal('caches', {
      default: cacheMock,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          title: 'fresh',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPI } = await import('common/apis/base');
    const result = await fetchAPI<{ title: string }>('query Test { title }', {
      cache: {},
    });

    expect(result).toEqual({
      title: 'stale',
    });
    expect(cacheMock.match).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);

    const refreshPromise = waitUntil.mock.calls[0][0] as Promise<void>;
    await refreshPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cacheMock.put).toHaveBeenCalledTimes(1);
  });

  test('uses the JWT subject to share auth cache entries across valid tokens', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const createFreshCacheHitMock = () => {
      const cacheMock = createCacheMock();

      cacheMock.match.mockImplementation(() =>
        Promise.resolve(
          createCachedResponse(
            {
              title: 'cached',
            },
            Math.floor(now / 1000) - 60
          )
        )
      );

      return cacheMock;
    };

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPIWithAuthToken } = await import('common/apis/base');
    const firstToken = createJwtToken({
      sub: 'user-123',
      exp: Math.floor(now / 1000) + 3_600,
      jti: 'session-a',
    });
    const secondToken = createJwtToken({
      sub: 'user-123',
      exp: Math.floor(now / 1000) + 3_600,
      jti: 'session-b',
    });

    const firstCacheMock = createFreshCacheHitMock();
    vi.stubGlobal('caches', {
      default: firstCacheMock,
    });

    const firstResult = await fetchAPIWithAuthToken<{ title: string }>(
      'query Test { title }',
      {
        authToken: firstToken,
        cache: {},
      }
    );

    const firstCacheKey = firstCacheMock.match.mock.calls[0]?.[0];

    const secondCacheMock = createFreshCacheHitMock();
    vi.stubGlobal('caches', {
      default: secondCacheMock,
    });

    const secondResult = await fetchAPIWithAuthToken<{ title: string }>(
      'query Test { title }',
      {
        authToken: secondToken,
        cache: {},
      }
    );

    const secondCacheKey = secondCacheMock.match.mock.calls[0]?.[0];

    expect(firstResult).toEqual({
      title: 'cached',
    });
    expect(secondResult).toEqual({
      title: 'cached',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(firstCacheMock.put).not.toHaveBeenCalled();
    expect(secondCacheMock.put).not.toHaveBeenCalled();

    expect(firstCacheKey).toBeInstanceOf(Request);
    expect(secondCacheKey).toBeInstanceOf(Request);
    expect((firstCacheKey as Request).url).toBe((secondCacheKey as Request).url);
  });

  test('bypasses Cloudflare cache when the auth JWT is expired', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const cacheMock = createCacheMock();
    cacheMock.match.mockResolvedValue(
      createCachedResponse(
        {
          title: 'cached',
        },
        Math.floor(now / 1000)
      )
    );

    vi.stubGlobal('caches', {
      default: cacheMock,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          title: 'fresh',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPIWithAuthToken } = await import('common/apis/base');
    const expiredToken = createJwtToken({
      sub: 'user-123',
      exp: Math.floor(now / 1000) - 1,
    });

    const result = await fetchAPIWithAuthToken<{ title: string }>(
      'query Test { title }',
      {
        authToken: expiredToken,
        cache: {},
      }
    );

    expect(result).toEqual({
      title: 'fresh',
    });
    expect(cacheMock.match).not.toHaveBeenCalled();
    expect(cacheMock.put).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `${PAYLOAD_BASE_URL}/api/graphql`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${expiredToken}`,
        }),
      })
    );
  });

  test('falls back to a live fetch when the Cache API is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPI } = await import('common/apis/base');
    const result = await fetchAPI<{ ok: boolean }>('query Test { ok }', {
      cache: {},
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
