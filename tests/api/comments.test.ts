import handler from 'pages/api/comments';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createComment, getComments } from 'common/apis/comments';
import { BETTER_AUTH_TOKEN_COOKIE } from 'common/utils/auth';

vi.mock('common/apis/comments', () => ({
  createComment: vi.fn(),
  getComments: vi.fn(),
}));

vi.mock('common/utils/chapter-password-proof', () => ({
  getChapterPasswordProofCookieValueFromRequest: vi.fn(() => 'chapter-proof-123'),
}));

const mockedGetComments = vi.mocked(getComments);
const mockedCreateComment = vi.mocked(createComment);

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

describe('comments API route', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects GET requests that provide both chapterId and postId', async () => {
    const { res } = await runHandler({
      method: 'GET',
      query: {
        chapterId: '10',
        postId: '22',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: 'Provide exactly one of chapterId or postId.',
    });
  });

  test('forwards chapter proof when loading chapter comments', async () => {
    mockedGetComments.mockResolvedValue({
      docs: [],
      totalDocs: 0,
      viewerCanComment: false,
    });

    const { res } = await runHandler({
      method: 'GET',
      query: {
        chapterId: '10',
      },
    });

    expect(mockedGetComments).toHaveBeenCalledWith(
      { chapterId: '10', postId: undefined },
      { authToken: null, chapterPasswordProof: 'chapter-proof-123' }
    );
    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Cache-Control')).toBe('no-store, max-age=0');
  });

  test('forwards auth token and chapter proof when creating chapter comments', async () => {
    mockedCreateComment.mockResolvedValue(null);

    const { res } = await runHandler({
      method: 'POST',
      body: {
        chapterId: '10',
        content: 'New comment',
        parentCommentId: '5',
      },
      cookies: {
        [BETTER_AUTH_TOKEN_COOKIE]: 'reader-token',
      },
    });

    expect(mockedCreateComment).toHaveBeenCalledWith(
      {
        chapterId: '10',
        postId: undefined,
        content: 'New comment',
        parentCommentId: '5',
      },
      {
        authToken: 'reader-token',
        chapterPasswordProof: 'chapter-proof-123',
      }
    );
    expect(res.statusCode).toBe(200);
  });
});
