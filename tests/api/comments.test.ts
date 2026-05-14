import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createComment, getComments } from '@/lib/payload/comments';
import { COMMENT_MAX_LENGTH } from '@/lib/constants/comments';
import { BETTER_AUTH_TOKEN_COOKIE } from '@/lib/auth/auth';
import { GET, POST } from '@/app/api/comments/route';

vi.mock('@/lib/payload/comments', () => ({
  createComment: vi.fn(),
  getComments: vi.fn(),
}));

vi.mock('@/lib/server/chapter-password-proof', () => ({
  getChapterPasswordProofCookieValueFromRequest: vi.fn(() => 'chapter-proof-123'),
}));

const mockedGetComments = vi.mocked(getComments);
const mockedCreateComment = vi.mocked(createComment);

async function runGet(query: Record<string, string>) {
  const url = new URL('http://localhost/api/comments');
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return GET(new NextRequest(url));
}

async function runPost(body: Record<string, unknown>, cookie?: string) {
  return POST(
    new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

describe('comments API route', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects GET requests that provide both chapterId and postId', async () => {
    const response = await runGet({ chapterId: '10', postId: '22' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Provide exactly one of chapterId or postId.',
    });
  });

  test('forwards chapter proof when loading chapter comments', async () => {
    mockedGetComments.mockResolvedValue({
      docs: [],
      totalDocs: 0,
      viewerCanComment: false,
    });

    const response = await runGet({ chapterId: '10' });

    expect(mockedGetComments).toHaveBeenCalledWith(
      { chapterId: '10', postId: undefined },
      { authToken: null, chapterPasswordProof: 'chapter-proof-123' }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  test('forwards auth token and chapter proof when creating chapter comments', async () => {
    mockedCreateComment.mockResolvedValue(null);

    const response = await runPost(
      {
        chapterId: '10',
        content: 'New comment',
        parentCommentId: '5',
      },
      `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`
    );

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
    expect(response.status).toBe(200);
  });

  test('rejects comments longer than the configured limit', async () => {
    const response = await runPost(
      {
        postId: '22',
        content: 'x'.repeat(COMMENT_MAX_LENGTH + 1),
      },
      `${BETTER_AUTH_TOKEN_COOKIE}=reader-token`
    );

    expect(mockedCreateComment).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `content must be at most ${COMMENT_MAX_LENGTH} characters.`,
    });
  });
});
