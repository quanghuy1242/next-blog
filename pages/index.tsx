import { useEffect, useMemo } from 'react';
import { getDataForHome } from 'common/apis/index';
import { getCategoryIdBySlug } from 'common/apis/categories';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Posts } from 'components/shared/posts';
import { Text } from 'components/shared/text';
import { generateHomepageMetaTags } from 'common/utils/meta-tags';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { HomePageData } from 'types/cms';
import { useAppContext } from 'context/state';
import {
  normalizeQueryParam,
  normalizeQueryParamList,
} from 'common/utils/query';
import { useHomePosts } from 'hooks/useHomePosts';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';

interface HomePageProps {
  initialPosts: HomePageData['allPosts'];
  allCategories: HomePageData['allCategories'];
  homepage: HomePageData['homepage'];
  initialHasMore: boolean;
  initialCategory: string | null;
  initialTags: string[];
}

const POSTS_PAGE_SIZE = 5;

/**
 * Home page with filter-aware infinite scrolling.
 *
 * Reads `category`/`tag` query params, fetches matching posts via `useHomePosts`,
 * and keeps the result cached in context so navigation restores the filtered
 * view. Infinite scrolling respects the current filter set.
 */
export default function Index({
  initialPosts,
  homepage,
  allCategories,
  initialHasMore,
  initialCategory,
  initialTags,
}: HomePageProps) {
  const header = homepage?.header || '';
  const metaTags = generateHomepageMetaTags(homepage?.meta, {
    title: homepage?.header || 'Blog',
    description: homepage?.subHeader || '',
  });
  const { homePosts, setHomePosts } = useAppContext();
  const router = useRouter();

  const activeCategory = useMemo(
    () =>
      router.isReady
        ? normalizeQueryParam(router.query.category)
        : initialCategory,
    [router.isReady, router.query.category, initialCategory]
  );

  const activeTags = useMemo(
    () =>
      router.isReady ? normalizeQueryParamList(router.query.tag) : initialTags,
    [router.isReady, router.query.tag, initialTags]
  );

  const {
    postsState,
    isFetching,
    error,
    hasActiveFilters,
    loadMorePosts,
    refetchCurrentFilters,
  } = useHomePosts({
    initialPosts,
    initialHasMore,
    initialCategory,
    initialTags,
    pageSize: POSTS_PAGE_SIZE,
    activeCategory,
    activeTags,
    routerReady: router.isReady,
    homePosts,
    setHomePosts,
  });

  // Use intersection observer hook for infinite scroll
  const { ref: loaderRef, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({
      rootMargin: '200px 0px',
      enabled: postsState.hasMore,
    });

  // Trigger load more when sentinel is intersecting
  useEffect(() => {
    if (isIntersecting && postsState.hasMore) {
      void loadMorePosts();
    }
  }, [isIntersecting, postsState.hasMore, loadMorePosts]);

  return (
    <Layout header={header} className="flex flex-col items-center">
      <Head>{renderMetaTags(metaTags)}</Head>
      <Banner
        header={header}
        subHeader={homepage?.subHeader || ''}
        imageBanner={homepage?.imageBanner || null}
        className="w-full"
      />
      <Container className="flex flex-col md:flex-row md:px-20">
        <div className="flex-grow md:w-2/3 md:mr-6">
          <Text text="Latest Posts" />
          <Posts
            posts={postsState.posts}
            hasMoreCol={false}
            activeCategory={postsState.category}
            activeTags={postsState.tags}
          />
          {!isFetching && !error && postsState.posts.length === 0 && (
            <p className="mt-6 text-center text-sm text-gray-500">
              No posts found for this filter.
            </p>
          )}
          <div ref={loaderRef} className="h-1 w-full" aria-hidden />
          {isFetching && (
            <div className="my-6 flex justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
          )}
          {error && (
            <div className="mt-4 flex flex-col items-center text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  if (hasActiveFilters) {
                    void refetchCurrentFilters();
                  } else {
                    void loadMorePosts();
                  }
                }}
                className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:text-gray-900"
              >
                Try again
              </button>
            </div>
          )}
          {!postsState.hasMore && !isFetching && (
            <p className="my-6 text-center text-sm text-gray-500">
              You&apos;ve reached the end.
            </p>
          )}
        </div>
        <div className="md:w-1/3">
          <Text text="Categories" />
          <Categories categories={allCategories} />
        </div>
      </Container>
    </Layout>
  );
}

/**
 * Fetch the server-rendered payload required to render the home page. The
 * initial posts respect incoming query filters so the first paint matches what
 * the user requested.
 */
export const getServerSideProps: GetServerSideProps<HomePageProps> = async (
  context
) => {
  const initialCategory = normalizeQueryParam(context.query.category);
  const initialTags = normalizeQueryParamList(context.query.tag);
  const tags = initialTags.length ? initialTags : null;

  let categoryId: number | null = null;

  if (initialCategory) {
    categoryId = await getCategoryIdBySlug(initialCategory);
  }

  const { data, hasMore } = await getDataForHome({
    limit: POSTS_PAGE_SIZE,
    categoryId: categoryId ? String(categoryId) : null,
    tags,
  });

  const categoryIsValid = !initialCategory || Boolean(categoryId);
  const initialPosts = categoryIsValid ? data.allPosts ?? [] : [];
  const initialHasMore = categoryIsValid ? hasMore : false;

  return {
    props: {
      initialPosts,
      allCategories: data.allCategories ?? [],
      homepage: data.homepage ?? null,
      initialHasMore,
      initialCategory,
      initialTags,
    },
  };
};
