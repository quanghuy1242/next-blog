import { NextRequest } from 'next/server';

import { getHomeFeedPage } from '@/lib/payload/home/feed';
import { json, methodNotAllowed } from '@/lib/server/http';
import { normalizeLimit, normalizeOffset } from '@/lib/utils/number';
import { normalizeQueryParam, normalizeQueryParamList } from '@/lib/utils/query';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = normalizeOffset(request.nextUrl.searchParams.get('offset'));
  const category = normalizeQueryParam(request.nextUrl.searchParams.get('category') ?? undefined);
  const tags = normalizeQueryParamList(request.nextUrl.searchParams.getAll('tag'));

  try {
    const feedPage = await getHomeFeedPage({
      limit,
      offset,
      category,
      tags,
    });

    return json({
      posts: feedPage.posts,
      hasMore: feedPage.hasMore,
      nextOffset: feedPage.nextOffset,
    });
  } catch (error) {
    console.error('Failed to fetch paginated posts', error);
    return json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

export function POST() {
  return methodNotAllowed(['GET']);
}
