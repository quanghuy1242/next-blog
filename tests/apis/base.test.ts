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

  test('returns a fresh Cloudflare cache hit without calling Payload', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const cacheMock = createCacheMock();
    cacheMock.match.mockResolvedValue(
      createCachedResponse(
        {
          title: 'cached',
        },
        Math.floor(now / 1000) - 60
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

  test('bypasses Cloudflare cache entirely when an auth token is present', async () => {
    const cacheMock = createCacheMock();
    cacheMock.match.mockResolvedValue(
      createCachedResponse(
        {
          title: 'cached',
        },
        Math.floor(Date.now() / 1000)
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
      authToken: 'token-123',
      cache: {},
    });

    expect(result).toEqual({
      title: 'fresh',
    });
    expect(cacheMock.match).not.toHaveBeenCalled();
    expect(cacheMock.put).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `${PAYLOAD_BASE_URL}/api/graphql`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
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
