import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { BETTER_AUTH_TOKEN_COOKIE } from '@/lib/auth/auth';
import { getChapterViewerState } from '@/lib/payload/book-viewer-state';
import { GET, POST } from '@/app/api/chapters/viewer-state/route';

vi.mock('@/lib/payload/book-viewer-state', () => ({
  getChapterViewerState: vi.fn(),
}));

const mockedGetChapterViewerState = vi.mocked(getChapterViewerState);

async function runGet({
  cookie,
  query,
}: {
  cookie?: string;
  query?: Record<string, string>;
}) {
  const url = new URL('http://localhost/api/chapters/viewer-state');
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

  return GET(new NextRequest(url, { headers: cookie ? { cookie } : undefined }));
}

describe('GET /api/chapters/viewer-state', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects non-GET methods', async () => {
    const response = POST();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });

  test('validates required IDs', async () => {
    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`,
      query: { bookId: '1' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'chapterId must be a positive integer.',
    });
  });

  test('returns empty state for anonymous requests', async () => {
    const response = await runGet({
      query: { bookId: '1', chapterId: '2' },
    });

    expect(mockedGetChapterViewerState).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    await expect(response.json()).resolves.toEqual({
      bookmark: null,
      readingProgress: [],
    });
  });

  test('returns viewer state for authenticated requests', async () => {
    mockedGetChapterViewerState.mockResolvedValue({
      bookmark: null,
      readingProgress: [
        {
          chapterId: '2',
          progress: 50,
          completedAt: null,
          updatedAt: '2026-05-15T00:00:00.000Z',
        },
      ],
      readingProgressByChapterId: { 2: 50 },
    });

    const response = await runGet({
      cookie: `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`,
      query: { bookId: '1', chapterId: '2' },
    });

    expect(mockedGetChapterViewerState).toHaveBeenCalledWith(1, 2, {
      authToken: 'reader-token',
    });
    await expect(response.json()).resolves.toEqual({
      bookmark: null,
      readingProgress: [
        {
          chapterId: '2',
          progress: 50,
          completedAt: null,
          updatedAt: '2026-05-15T00:00:00.000Z',
        },
      ],
      readingProgressByChapterId: { 2: 50 },
    });
  });
});
