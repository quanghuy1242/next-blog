import type { PayloadCacheSettings } from '../core/cache';
import { getCategoryIdBySlug } from '../taxonomy/categories';
import { getPaginatedPosts } from '../posts/list';
import { uniqueSortedStrings } from '@/lib/utils/query';
import type { Post } from '@/types/cms';

export interface HomeFeedPageParams {
  limit: number;
  offset?: number;
  category: string | null;
  tags: string[];
  cache?: PayloadCacheSettings;
}

export interface HomeFeedPageResult {
  posts: Post[];
  hasMore: boolean;
  nextOffset: number;
  category: string | null;
  tags: string[];
  categoryId: number | null;
  categoryIsValid: boolean;
}

export async function getHomeFeedPage({
  limit,
  offset = 0,
  category,
  tags,
  cache,
}: HomeFeedPageParams): Promise<HomeFeedPageResult> {
  const normalizedCategory = normalizeCategorySlug(category);
  const normalizedTags = uniqueSortedStrings(tags);
  const categoryId = normalizedCategory
    ? await getCategoryIdBySlug(normalizedCategory, { cache })
    : null;
  const categoryIsValid = !normalizedCategory || categoryId != null;

  if (!categoryIsValid) {
    return {
      posts: [],
      hasMore: false,
      nextOffset: offset,
      category: normalizedCategory,
      tags: normalizedTags,
      categoryId: null,
      categoryIsValid: false,
    };
  }

  const { posts, hasMore } = await getPaginatedPosts({
    limit,
    skip: offset,
    categoryId: categoryId ? String(categoryId) : null,
    tags: normalizedTags,
  });

  return {
    posts,
    hasMore,
    nextOffset: offset + posts.length,
    category: normalizedCategory,
    tags: normalizedTags,
    categoryId,
    categoryIsValid: true,
  };
}

function normalizeCategorySlug(category: string | null): string | null {
  if (!category) {
    return null;
  }

  const trimmed = category.trim();

  return trimmed.length ? trimmed : null;
}
