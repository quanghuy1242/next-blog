import { NextRequest } from 'next/server';

import { getCategoryIdBySlug } from '@/lib/payload/categories';
import { getPaginatedPosts } from '@/lib/payload/posts';
import { json, methodNotAllowed } from '@/lib/server/http';
import { normalizeLimit, normalizeOffset } from '@/lib/utils/number';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = normalizeOffset(request.nextUrl.searchParams.get('offset'));
  const categorySlug = request.nextUrl.searchParams.get('category')?.trim() || null;
  const tag = request.nextUrl.searchParams.get('tag')?.trim() || null;

  try {
    const categoryIdNum = categorySlug ? await getCategoryIdBySlug(categorySlug) : null;

    if (categorySlug && !categoryIdNum) {
      return json({
        posts: [],
        hasMore: false,
        nextOffset: offset,
      });
    }

    const { posts, hasMore } = await getPaginatedPosts({
      limit,
      skip: offset,
      categoryId: categoryIdNum ? String(categoryIdNum) : null,
      tags: tag ? [tag] : null,
    });

    return json({
      posts,
      hasMore,
      nextOffset: offset + posts.length,
    });
  } catch (error) {
    console.error('Failed to fetch paginated posts', error);
    return json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

export function POST() {
  return methodNotAllowed(['GET']);
}
