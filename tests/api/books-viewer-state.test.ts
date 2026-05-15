import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { BETTER_AUTH_TOKEN_COOKIE } from '@/lib/domain/auth/tokens';
import { AUTH_PAYLOAD_CACHE } from '@/lib/payload/core/cache';
import {
  getBookCardsViewerState,
  getBookDetailViewerState,
} from '@/lib/payload/books/viewer-state';
import { fetchPublicBookPagePayload } from '@/lib/payload/books/pages';
import { GET, POST } from '@/app/api/books/viewer-state/route';

vi.mock('@/lib/payload/books/viewer-state', () => ({
  getBookCardsViewerState: vi.fn(),
  getBookDetailViewerState: vi.fn(),
}));

vi.mock('@/lib/payload/books/pages', () => ({
  fetchPublicBookPagePayload: vi.fn(),
}));

const mockedGetBookCardsViewerState = vi.mocked(getBookCardsViewerState);
const mockedGetBookDetailViewerState = vi.mocked(getBookDetailViewerState);
const mockedFetchPublicBookPagePayload = vi.mocked(fetchPublicBookPagePayload);

async function runGet({
  cookie,
  query,
}: {
  cookie?: string;
  query?: Record<string, string>;
}) {
  const url = new URL('http://localhost/api/books/viewer-state');
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

  return GET(new NextRequest(url, { headers: cookie ? { cookie } : undefined }));
}

describe('GET /api/books/viewer-state', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects non-GET methods', async () => {
    const response = POST();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });

  test('returns empty state for anonymous requests', async () => {
    const response = await runGet({ query: { bookIds: '1,2' } });

    expect(mockedGetBookCardsViewerState).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    await expect(response.json()).resolves.toEqual({ books: [] });
  });

  test('rejects invalid book IDs', async () => {
    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`,
      query: { bookIds: '1,nope' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'bookIds must contain positive integers.',
    });
  });

  test('returns card viewer state for authenticated requests', async () => {
    mockedGetBookCardsViewerState.mockResolvedValue([
      {
        bookId: 1,
        isBookmarked: true,
        bookmarkId: 11,
        readingProgressPct: 40,
      },
    ]);

    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`,
      query: { bookIds: '1' },
    });

    expect(mockedGetBookCardsViewerState).toHaveBeenCalledWith([1], {
      authToken: 'reader-token',
      cache: AUTH_PAYLOAD_CACHE,
    });
    await expect(response.json()).resolves.toEqual({
      books: [
        {
          bookId: 1,
          isBookmarked: true,
          bookmarkId: 11,
          readingProgressPct: 40,
        },
      ],
    });
  });

  test('returns detail state when requested for a single book', async () => {
    mockedGetBookCardsViewerState.mockResolvedValue([]);
    mockedFetchPublicBookPagePayload.mockResolvedValue({
      book: { id: 1, totalWordCount: 1000 } as never,
      chapters: [{ id: 2, slug: 'chapter-1', chapterWordCount: 1000 }] as never,
    });
    mockedGetBookDetailViewerState.mockResolvedValue({
      bookId: 1,
      bookmark: null,
      readingProgress: [],
      continueReadingChapterSlug: null,
      wholeBookProgress: 0,
    });

    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`,
      query: { bookIds: '1', detail: '1' },
    });

    expect(mockedFetchPublicBookPagePayload).toHaveBeenCalledWith(1, {
      authToken: 'reader-token',
      cache: AUTH_PAYLOAD_CACHE,
    });
    expect(mockedGetBookDetailViewerState).toHaveBeenCalledWith(
      { id: 1, totalWordCount: 1000 },
      [{ id: 2, slug: 'chapter-1', chapterWordCount: 1000 }],
      { authToken: 'reader-token' }
    );
    await expect(response.json()).resolves.toEqual({
      books: [],
      detail: {
        bookId: 1,
        bookmark: null,
        readingProgress: [],
        continueReadingChapterSlug: null,
        wholeBookProgress: 0,
      },
    });
  });
});
