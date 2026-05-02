import handler from 'pages/api/books';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getPaginatedBooks } from 'common/apis/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from 'common/apis/cache';
import { BETTER_AUTH_TOKEN_COOKIE } from 'common/utils/auth';

vi.mock('common/apis/books', () => ({
  getPaginatedBooks: vi.fn(),
}));

const mockedGetPaginatedBooks = vi.mocked(getPaginatedBooks);

function runHandler(
  req: Parameters<typeof createMocks>[0],
  res?: Parameters<typeof createMocks>[1]
) {
  const { req: request, res: response } = createMocks(req, res);
  return handler(
    request as unknown as NextApiRequest,
    response as unknown as NextApiResponse
  ).then(() => ({ req: request, res: response }));
}

describe('GET /api/books', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects non-GET methods', async () => {
    const { res } = await runHandler({ method: 'POST' });

    expect(res.statusCode).toBe(405);
    expect(res.getHeader('Allow')).toBe('GET');
    expect(res._getJSONData()).toEqual({ error: 'Method Not Allowed' });
  });

  test('normalizes query params and returns paginated books', async () => {
    mockedGetPaginatedBooks.mockResolvedValue({
      books: [{ slug: 'book-1' } as never],
      hasMore: true,
    });

    const { res } = await runHandler({
      method: 'GET',
      query: {
        limit: '99',
        offset: '-12',
      },
    });

    expect(mockedGetPaginatedBooks).toHaveBeenCalledWith({
      limit: 50,
      skip: 0,
    }, {
      authToken: null,
      cache: ONE_HOUR_PAYLOAD_CACHE,
    });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      books: [{ slug: 'book-1' }],
      hasMore: true,
      nextOffset: 1,
    });
  });

  test('forwards the session token to Payload', async () => {
    mockedGetPaginatedBooks.mockResolvedValue({
      books: [],
      hasMore: false,
    });

    const { res } = await runHandler({
      method: 'GET',
      cookies: {
        [BETTER_AUTH_TOKEN_COOKIE]: 'token-123',
      },
    });

    expect(mockedGetPaginatedBooks).toHaveBeenCalledWith({
      limit: 6,
      skip: 0,
    }, {
      authToken: 'token-123',
      cache: AUTH_PAYLOAD_CACHE,
    });

    expect(res.getHeader('Cache-Control')).toBe('no-store, max-age=0');
  });

  test('returns server error when fetching books fails', async () => {
    mockedGetPaginatedBooks.mockRejectedValue(new Error('Network error'));

    const { res } = await runHandler({
      method: 'GET',
    });

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to load books' });
  });
});
