import { getCategoryIdBySlug } from '@/lib/payload/categories';
import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getDataForHome } from '@/lib/payload/index';
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
  const tags = initialTags.length ? initialTags : null;
  let categoryId: number | null = null;

  if (initialCategory) {
    categoryId = await getCategoryIdBySlug(initialCategory, {
      cache: ONE_HOUR_PAYLOAD_CACHE,
    });
  }

  const { data, hasMore } = await getDataForHome({
    limit: POSTS_PAGE_SIZE,
    categoryId: categoryId ? String(categoryId) : null,
    tags,
    cache: ONE_HOUR_PAYLOAD_CACHE,
  });
  const categoryIsValid = !initialCategory || Boolean(categoryId);

  return {
    allCategories: data.allCategories ?? [],
    homepage: data.homepage ?? null,
    initialCategory,
    initialHasMore: categoryIsValid ? hasMore : false,
    initialPosts: categoryIsValid ? data.allPosts ?? [] : [],
    initialTags,
  };
}

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
    <Layout header={data.homepage?.header} className="flex flex-col items-center">
      <HomePageClient {...data} />
    </Layout>
  );
}
