import { getCategoryIdBySlug } from 'common/apis/categories';
import { getPaginatedPosts } from 'common/apis/posts';
import { normalizeLimit, normalizeOffset } from 'common/utils/number';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export async function getMorePosts(
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
  category?: string,
  tag?: string
) {
  const limitNorm = normalizeLimit(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const offsetNorm = normalizeOffset(offset);

  let categoryIdNum: number | null = null;
  if (category) {
    categoryIdNum = await getCategoryIdBySlug(category);
  }

  if (category && !categoryIdNum) {
    return {
      posts: [],
      hasMore: false,
      nextOffset: offsetNorm,
    };
  }

  const tags = tag ? [tag] : [];

  const { posts, hasMore } = await getPaginatedPosts({
    limit: limitNorm,
    skip: offsetNorm,
    categoryId: categoryIdNum ? String(categoryIdNum) : null,
    tags: tags.length ? tags : null,
  });

  return {
    posts,
    hasMore,
    nextOffset: offsetNorm + posts.length,
  };
}
