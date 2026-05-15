import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getPaginatedBooks } from '@/lib/payload/books/catalog';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/core/cache';
import { BETTER_AUTH_TOKEN_COOKIE } from '@/lib/auth/auth';
import { GET, POST } from '@/app/api/books/route';

vi.mock('@/lib/payload/books/catalog', () => ({
  getPaginatedBooks: vi.fn(),
}));

const mockedGetPaginatedBooks = vi.mocked(getPaginatedBooks);

async function runGet({
  cookie,
  query,
}: {
  cookie?: string;
  query?: Record<string, string>;
}) {
  const url = new URL('http://localhost/api/books');

  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

  return GET(
    new NextRequest(url, {
      headers: cookie ? { cookie } : undefined,
    })
  );
}

describe('GET /api/books', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects non-GET methods', async () => {
    const response = POST();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    await expect(response.json()).resolves.toEqual({ error: 'Method Not Allowed' });
  });

  test('normalizes query params and returns paginated books', async () => {
    mockedGetPaginatedBooks.mockResolvedValue({
      books: [{ slug: 'book-1' } as never],
      hasMore: true,
    });

    const response = await runGet({
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
      includeViewerState: false,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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

    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=token-123`,
    });

    expect(mockedGetPaginatedBooks).toHaveBeenCalledWith({
      limit: 6,
      skip: 0,
    }, {
      authToken: 'token-123',
      cache: AUTH_PAYLOAD_CACHE,
      includeViewerState: false,
    });

    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  test('returns server error when fetching books fails', async () => {
    mockedGetPaginatedBooks.mockRejectedValue(new Error('Network error'));

    const response = await runGet({});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to load books' });
  });
});
