import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createBookmark, getBookmarks } from '@/lib/payload/books/bookmarks';
import { BETTER_AUTH_TOKEN_COOKIE } from '@/lib/domain/auth/tokens';
import { GET, POST } from '@/app/api/bookmarks/route';

vi.mock('@/lib/payload/books/bookmarks', () => ({
  createBookmark: vi.fn(),
  getBookmarks: vi.fn(),
}));

const mockedGetBookmarks = vi.mocked(getBookmarks);
const mockedCreateBookmark = vi.mocked(createBookmark);

async function runGet({
  cookie,
  query,
}: {
  cookie?: string;
  query?: Record<string, string>;
}) {
  const url = new URL('http://localhost/api/bookmarks');
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return GET(new NextRequest(url, { headers: cookie ? { cookie } : undefined }));
}

async function runPost(body: Record<string, unknown>, cookie?: string) {
  return POST(
    new NextRequest('http://localhost/api/bookmarks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

describe('bookmarks API route', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('returns an empty bookmark list for anonymous GET requests', async () => {
    const response = await runGet({});

    expect(mockedGetBookmarks).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    await expect(response.json()).resolves.toEqual({ docs: [], totalDocs: 0 });
  });

  test('rejects partial bookmark lookup filters', async () => {
    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`,
      query: {
        contentType: 'book',
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'contentType and contentId must be provided together.',
    });
  });

  test('rejects book bookmark creation when chapterId is provided', async () => {
    mockedCreateBookmark.mockResolvedValue({
      created: true,
      bookmarkId: 1,
    });

    const response = await runPost(
      {
        contentType: 'book',
        bookId: '7',
        chapterId: '11',
      },
      `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`
    );

    expect(mockedCreateBookmark).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'chapterId is not allowed for book bookmarks.',
    });
  });
});
