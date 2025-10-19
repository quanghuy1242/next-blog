import { useEffect, useMemo, useRef } from 'react';
import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Posts } from 'components/shared/posts';
import { Text } from 'components/shared/text';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';
import { useRouter } from 'next/router';
import type { HomePageData } from 'types/datocms';
import { useAppContext } from 'context/state';
import { normalizeQueryParam, normalizeQueryParamList } from 'common/utils/query';
import { useHomePosts } from 'hooks/useHomePosts';

interface HomePageProps {
  allPosts: HomePageData['allPosts'];
  allCategories: HomePageData['allCategories'];
  homepage: HomePageData['homepage'];
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
  allPosts,
  homepage,
  allCategories,
}: HomePageProps) {
  const header = homepage?.header || '';
  const { homePosts, setHomePosts } = useAppContext();
  const router = useRouter();

  const activeCategory = useMemo(
    () => (router.isReady ? normalizeQueryParam(router.query.category) : null),
    [router.isReady, router.query.category]
  );

  const activeTags = useMemo(
    () => (router.isReady ? normalizeQueryParamList(router.query.tag) : []),
    [router.isReady, router.query.tag]
  );

  const {
    postsState,
    isFetching,
    error,
    hasActiveFilters,
    loadMorePosts,
    refetchCurrentFilters,
  } = useHomePosts({
    initialPosts: allPosts,
    pageSize: POSTS_PAGE_SIZE,
    activeCategory,
    activeTags,
    routerReady: router.isReady,
    homePosts,
    setHomePosts,
  });

  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!postsState.hasMore) {
      return;
    }

    const sentinel = loaderRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry?.isIntersecting) {
          void loadMorePosts();
        }
      },
      {
        rootMargin: '200px 0px',
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMorePosts, postsState.hasMore]);

  return (
    <Layout header={header} className="flex flex-col items-center">
      <Head>{renderMetaTags(homepage?.metadata || [])}</Head>
      <Banner
        header={header}
        subHeader={homepage?.subHeader || ''}
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
 * Fetch the static payload required to render the home page. Runs at build
 * time (and revalidates) so the initial render is always hydrated with posts
 * and metadata before client-side filtering kicks in.
 */
export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const data = await getDataForHome();

  return {
    props: {
      allPosts: data.allPosts ?? [],
      allCategories: data.allCategories ?? [],
      homepage: data.homepage ?? null,
    },
    revalidate: 60,
  };
};
