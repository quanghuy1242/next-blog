import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getCategoryIdBySlug } from '@/lib/payload/categories';
import { getPaginatedPosts } from '@/lib/payload/posts';
import type { Post } from '@/types/cms';
import { GET, POST } from '@/app/api/posts/route';

vi.mock('@/lib/payload/categories', () => ({
  getCategoryIdBySlug: vi.fn(),
}));

vi.mock('@/lib/payload/posts', () => ({
  getPaginatedPosts: vi.fn(),
}));

const mockedGetCategoryIdBySlug = vi.mocked(getCategoryIdBySlug);
const mockedGetPaginatedPosts = vi.mocked(getPaginatedPosts);

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Test post',
    slug: overrides.slug ?? 'test',
    excerpt: overrides.excerpt ?? null,
    content: overrides.content ?? null,
    coverImage: overrides.coverImage ?? null,
    author: overrides.author ?? null,
    category: overrides.category ?? null,
    tags: overrides.tags ?? null,
    meta: overrides.meta ?? null,
    _status: overrides._status ?? 'published',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

async function runGet(query?: Record<string, string>) {
  const url = new URL('http://localhost/api/posts');
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return GET(new NextRequest(url));
}

describe('GET /api/posts', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('rejects non-GET methods', async () => {
    const response = POST();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    await expect(response.json()).resolves.toEqual({ error: 'Method Not Allowed' });
  });

  test('normalizes query params and returns paginated posts', async () => {
    mockedGetCategoryIdBySlug.mockResolvedValue(null);
    mockedGetPaginatedPosts.mockResolvedValue({
      posts: [createPost()],
      hasMore: true,
    });

    const response = await runGet({
        limit: '100',
        offset: '-5',
    });

    expect(mockedGetPaginatedPosts).toHaveBeenCalledWith({
      limit: 50,
      skip: 0,
      categoryId: null,
      tags: [],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      posts: [createPost()],
      hasMore: true,
      nextOffset: 0 + 1,
    });
  });

  test('short-circuits when category slug cannot be resolved', async () => {
    mockedGetCategoryIdBySlug.mockResolvedValue(null);

    const response = await runGet({ category: 'unknown' });

    expect(mockedGetPaginatedPosts).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      posts: [],
      hasMore: false,
      nextOffset: 0,
    });
  });

  test('returns server error when fetching posts fails', async () => {
    mockedGetCategoryIdBySlug.mockResolvedValue(1);
    mockedGetPaginatedPosts.mockRejectedValue(new Error('Network error'));

    const response = await runGet();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to load posts' });
  });
});
