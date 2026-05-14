import { cache } from 'react';

import { getHomeFeedPage } from '@/lib/home/posts-feed';
import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getHomePageShell } from '@/lib/payload/index';
import { buildMetadata } from '@/lib/utils/next-metadata';
import { normalizeQueryParam, normalizeQueryParamList } from '@/lib/utils/query';
import { Layout } from '@/components/core/layout';
import { HomePageClient } from '@/components/pages/index/home-page-client';

const POSTS_PAGE_SIZE = 5;

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function loadHomePageData(searchParams: Record<string, string | string[] | undefined>) {
  const initialCategory = normalizeQueryParam(searchParams.category);
  const initialTags = normalizeQueryParamList(searchParams.tag);
  return loadHomePageDataForFilters(initialCategory, initialTags.join('\u0000'));
}

const loadHomePageDataForFilters = cache(async (
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

export async function generateMetadata({ searchParams }: HomePageProps) {
  const data = await loadHomePageData(await searchParams);

  return buildMetadata({
    title: data.homepage?.meta?.title || data.homepage?.header || 'Blog',
    description: data.homepage?.meta?.description || data.homepage?.subHeader || '',
    image: data.homepage?.meta?.image?.url || null,
  });
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const data = await loadHomePageData(await searchParams);

  return (
    <Layout className="flex flex-col items-center">
      <HomePageClient {...data} />
    </Layout>
  );
}
