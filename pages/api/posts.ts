import type { NextApiRequest, NextApiResponse } from 'next';
import { getCategoryIdBySlug } from 'common/apis/categories';
import { getPaginatedPosts } from 'common/apis/posts';
import { normalizeLimit, normalizeOffset } from 'common/utils/number';
import { normalizeQueryParam, normalizeQueryParamList } from 'common/utils/query';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const limit = normalizeLimit(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const offset = normalizeOffset(req.query.offset);
  const categorySlug = normalizeQueryParam(req.query.category);
  const tags = normalizeQueryParamList(req.query.tag);

  try {
    const categoryId = categorySlug
      ? await getCategoryIdBySlug(categorySlug)
      : null;

    if (categorySlug && !categoryId) {
      res.status(200).json({
        posts: [],
        hasMore: false,
        nextOffset: offset,
      });
      return;
    }

    const { posts, hasMore } = await getPaginatedPosts({
      limit,
      skip: offset,
      categoryId,
      tags: tags.length ? tags : null,
    });

    res.status(200).json({
      posts,
      hasMore,
      nextOffset: offset + posts.length,
    });
  } catch (error) {
    console.error('Failed to fetch paginated posts', error);
    res.status(500).json({ error: 'Failed to load posts' });
  }
}
