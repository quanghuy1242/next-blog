import handler from 'pages/api/bookmarks';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createBookmark, getBookmarks } from 'common/apis/bookmarks';
import { BETTER_AUTH_TOKEN_COOKIE } from 'common/utils/auth';

vi.mock('common/apis/bookmarks', () => ({
  createBookmark: vi.fn(),
  getBookmarks: vi.fn(),
}));

const mockedGetBookmarks = vi.mocked(getBookmarks);
const mockedCreateBookmark = vi.mocked(createBookmark);

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

describe('bookmarks API route', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('returns an empty bookmark list for anonymous GET requests', async () => {
    const { res } = await runHandler({
      method: 'GET',
    });

    expect(mockedGetBookmarks).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Cache-Control')).toBe('no-store, max-age=0');
    expect(res._getJSONData()).toEqual({ docs: [], totalDocs: 0 });
  });

  test('rejects partial bookmark lookup filters', async () => {
    const { res } = await runHandler({
      method: 'GET',
      cookies: {
        [BETTER_AUTH_TOKEN_COOKIE]: 'reader-token',
      },
      query: {
        contentType: 'book',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: 'contentType and contentId must be provided together.',
    });
  });

  test('rejects book bookmark creation when chapterId is provided', async () => {
    mockedCreateBookmark.mockResolvedValue({
      created: true,
      bookmarkId: 'bookmark-1',
    });

    const { res } = await runHandler({
      method: 'POST',
      cookies: {
        [BETTER_AUTH_TOKEN_COOKIE]: 'reader-token',
      },
      body: {
        contentType: 'book',
        bookId: '7',
        chapterId: '11',
      },
    });

    expect(mockedCreateBookmark).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: 'chapterId is not allowed for book bookmarks.',
    });
  });
});
