import handler from 'pages/api/books';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getPaginatedBooks } from 'common/apis/books';

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
    });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      books: [{ slug: 'book-1' }],
      hasMore: true,
      nextOffset: 1,
    });
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
