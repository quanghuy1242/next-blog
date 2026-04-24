import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const PAYLOAD_BASE_URL = 'https://payload.example.com';

describe('fetchAPIWithAuthToken', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PAYLOAD_BASE_URL', PAYLOAD_BASE_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test('does not mix in the API key when no auth token is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { fetchAPIWithAuthToken } = await import('common/apis/base');

    const result = await fetchAPIWithAuthToken<{ ok: boolean }>('query Test { ok }');

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

  test('uses the JWT token when one is provided', async () => {
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
          Authorization: 'JWT token-123',
        },
        body: JSON.stringify({
          query: 'query Test { ok }',
          variables: undefined,
        }),
      })
    );
  });
});