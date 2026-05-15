import 'server-only';

import { cache } from 'react';

import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getHomeFeedPage } from '@/lib/payload/home-feed';
import { getHomePageShell } from '@/lib/payload/home-page-shell';
import { normalizeQueryParam, normalizeQueryParamList } from '@/lib/utils/query';

const POSTS_PAGE_SIZE = 5;

export async function getHomePageData(
  searchParams: Record<string, string | string[] | undefined>
) {
  const initialCategory = normalizeQueryParam(searchParams.category);
  const initialTags = normalizeQueryParamList(searchParams.tag);

  return getHomePageDataForFilters(initialCategory, initialTags.join('\u0000'));
}

const getHomePageDataForFilters = cache(async (
  initialCategory: string | null,
  initialTagsKey: string
) => {
  const initialTags = initialTagsKey ? initialTagsKey.split('\u0000') : [];
  const [shell, feedPage] = await Promise.all([
    getHomePageShell({
      cache: ONE_HOUR_PAYLOAD_CACHE,
    }),
    getHomeFeedPage({
      limit: POSTS_PAGE_SIZE,
      category: initialCategory,
      tags: initialTags,
      cache: ONE_HOUR_PAYLOAD_CACHE,
    }),
  ]);

  return {
    allCategories: shell.allCategories,
    homepage: shell.homepage,
    initialCategory: feedPage.category,
    initialHasMore: feedPage.hasMore,
    initialPosts: feedPage.posts,
    initialTags: feedPage.tags,
  };
});
