import handler from 'pages/api/posts';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getCategoryIdBySlug } from 'common/apis/categories';
import { getPaginatedPosts } from 'common/apis/posts';

vi.mock('common/apis/categories', () => ({
  getCategoryIdBySlug: vi.fn(),
}));

vi.mock('common/apis/posts', () => ({
  getPaginatedPosts: vi.fn(),
}));

const mockedGetCategoryIdBySlug = vi.mocked(getCategoryIdBySlug);
const mockedGetPaginatedPosts = vi.mocked(getPaginatedPosts);

function runHandler(
  req: Partial<NextApiRequest>,
  res?: Partial<NextApiResponse>
) {
  const { req: request, res: response } = createMocks(req, res);
  return handler(
    request as unknown as NextApiRequest,
    response as unknown as NextApiResponse
  ).then(() => ({ req: request, res: response }));
}

describe('GET /api/posts', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects non-GET methods', async () => {
    const { res } = await runHandler({ method: 'POST' });

    expect(res.statusCode).toBe(405);
    expect(res.getHeader('Allow')).toBe('GET');
    expect(res._getJSONData()).toEqual({ error: 'Method Not Allowed' });
  });

  test('normalizes query params and returns paginated posts', async () => {
    mockedGetCategoryIdBySlug.mockResolvedValue(null);
    mockedGetPaginatedPosts.mockResolvedValue({
      posts: [{ slug: 'test' }],
      hasMore: true,
    });

    const { res } = await runHandler({
      method: 'GET',
      query: {
        limit: '100',
        offset: '-5',
      },
    });

    expect(mockedGetPaginatedPosts).toHaveBeenCalledWith({
      limit: 50,
      skip: 0,
      categoryId: null,
      tags: null,
    });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      posts: [{ slug: 'test' }],
      hasMore: true,
      nextOffset: 0 + 1,
    });
  });

  test('short-circuits when category slug cannot be resolved', async () => {
    mockedGetCategoryIdBySlug.mockResolvedValue(null);

    const { res } = await runHandler({
      method: 'GET',
      query: {
        category: 'unknown',
      },
    });

    expect(mockedGetPaginatedPosts).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      posts: [],
      hasMore: false,
      nextOffset: 0,
    });
  });

  test('returns server error when fetching posts fails', async () => {
    mockedGetCategoryIdBySlug.mockResolvedValue('category-id');
    mockedGetPaginatedPosts.mockRejectedValue(new Error('Network error'));

    const { res } = await runHandler({
      method: 'GET',
    });

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to load posts' });
  });
});
